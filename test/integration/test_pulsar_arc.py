"""Integration tests for the Pulsar ARC (Advanced Resource Connector) runner.
"""

import string
import tempfile
import threading
from functools import lru_cache
from typing import Optional
from unittest.mock import patch

from galaxy.jobs import JobDestination, JobMappingException, JobWrapper
from galaxy.jobs.runners.pulsar import PulsarARCJobRunner
from galaxy.tool_util.verify.interactor import GalaxyInteractorApi
from galaxy_test.base.api import ApiTestInteractor
from galaxy_test.base.api_util import get_admin_api_key
from galaxy_test.base.env import target_url_parts
from galaxy_test.base.populators import DatasetPopulator
from .oidc.test_auth_oidc import (
    AbstractTestCases as OIDCAbstractTestCases,
    KEYCLOAK_TEST_PASSWORD,
    KEYCLOAK_TEST_USERNAME,
)


JOB_CONFIG_FILE = """
execution:
  default: arc
  environments:
    arc:
      runner: arc_runner
      url: ${galaxy_url}
runners:
  arc_runner:
      load: galaxy.jobs.runners.pulsar:PulsarARCJobRunner
"""

job_destination_ref = []

def set_job_destination(job_destination: str) -> None:
    """
    Store a reference to a job destination.
    """
    job_destination_ref[:] = [job_destination]


def get_job_destination() -> str:
    """
    Return the last stored job destination (if any).
    """
    return job_destination_ref[0] if job_destination_ref else None

def dynamic_job_rule(app, job, tool, user, next_dest=None):
    """
    Dynamic job rule that selects a job destination based on the stored job destination reference.
    """
    job_destination = get_job_destination()
    if not job_destination:
        raise JobMappingException("No job destination set for dynamic job rule.")

    # Create a JobDestination object with the stored job destination
    destination = JobDestination(
        id=job_destination,
        name=job_destination,
        runner="arc_runner",
        params={},
    )

    # Set the job destination in the job
    job.set_destination(destination)

    # Optionally, set the next destination if provided
    if next_dest:
        job.set_next_destination(next_dest)

    return destination



def job_config(template_str: str, **vars_) -> str:
    """
    Create a temporary job configuration file from the provided template string.
    """
    job_conf_template = string.Template(template_str)
    job_conf_str = job_conf_template.substitute(**vars_)
    with tempfile.NamedTemporaryFile(suffix="_arc_integration_job_conf.yml", mode="w", delete=False) as job_conf:
        job_conf.write(job_conf_str)
    return job_conf.name


job_wrapper_ref = []  # keeps a reference to the job wrapper for which a job was last queued
job_wrapper_event = threading.Event()  # synchronization event to signal that a job has been queued

def set_job_wrapper(job_wrapper: JobWrapper) -> None:
    """
    Store a job wrapper reference.
    """
    job_wrapper_ref[:] = [job_wrapper]


def get_job_wrapper() -> JobWrapper:
    """
    Return the last stored job wrapper reference (if any).
    """
    return job_wrapper_ref[0] if job_wrapper_ref else None


def queue_job(self, job_wrapper: JobWrapper) -> None:
    """
    Override the `queue_job()` method of the parent class of the Pulsar ARC job runner.

    Fails job queueing and tracks the job wrapper representing the job which should have been queued. Used to test that
    the logic overriding the job destination parameters works correctly.
    """
    set_job_wrapper(job_wrapper)
    job_wrapper_event.set()
    raise Exception("Job queueing failed for testing purposes. This is expected.")


@patch.object(PulsarARCJobRunner.__mro__[1], "queue_job", new=queue_job)
class TestArcPulsarIntegration(OIDCAbstractTestCases.BaseKeycloakIntegrationTestCase):
    """
    Integration test verifying the logic that selects an ARC endpoint URL and an OIDC provider.
    """

    dataset_populator: DatasetPopulator
    framework_tool_and_types = True

    _user_api_key: Optional[str] = None

    @classmethod
    def handle_galaxy_config_kwds(cls, config):
        super().handle_galaxy_config_kwds(config)
        host, port, url = target_url_parts()
        config["job_config_file"] = job_config(JOB_CONFIG_FILE, galaxy_url=url)

    def setUp(self):
        """
        Log-in via Keycloak (just once), override Galaxy interactor and initialize a dataset populator.
        """
        super().setUp()
        self._login_via_keycloak(
            KEYCLOAK_TEST_USERNAME, KEYCLOAK_TEST_PASSWORD, save_cookies=True
        )  # happens just once,
        self._galaxy_interactor = ApiTestInteractor(self, api_key=self._user_api_key)
        self.dataset_populator = DatasetPopulator(self.galaxy_interactor)
        self._job_wrapper = None

    def tearDown(self):
        self._job_wrapper = None

    @lru_cache(maxsize=1)  # login just once, even if the method is called multiple times
    def _login_via_keycloak(self, *args, **kwargs):
        """
        Override parent login method to log-in via Keycloak just once and to override the default Galaxy interactor.

        Normally, one would log in within the `setUpClass()` method and call it a day, but since `_login_via_keycloak()`
        is not a class method, this workaround is needed.
        """
        session, response = super()._login_via_keycloak(
            KEYCLOAK_TEST_USERNAME, KEYCLOAK_TEST_PASSWORD, save_cookies=True
        )
        api_interactor = GalaxyInteractorApi(
            galaxy_url=self.url,
            master_api_key=get_admin_api_key(),
            test_user="gxyuser@galaxy.org",
            # email for `KEYCLOAK_TEST_USERNAME`, defined in test/integration/oidc/galaxy-realm-export.json
        )
        self._user_api_key = api_interactor.api_key
        return session, response

    def test_queue_job_url_and_oidc_provider_selection(self):
        with self.dataset_populator.test_history() as history_id:
            hda = self.dataset_populator.new_dataset(history_id, content="abc")
            self.dataset_populator.run_tool(
                tool_id="cat",
                inputs={
                    "input1": {"src": "hda", "id": hda["id"]},
                },
                history_id=history_id,
            )
            self.dataset_populator.wait_for_history(history_id, timeout=10)

        job_wrapper_event.wait(timeout=1)
        job_wrapper = get_job_wrapper()
        assert job_wrapper is not None, "No job wrapper created."
