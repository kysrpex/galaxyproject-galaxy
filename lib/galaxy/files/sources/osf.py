"""Galaxy FileSource implementation for OSF.

# A general overview of the implementation should be included here;
# inspiration may be taken from elabftw.py or rspace.py.
"""

from abc import ABC
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import urljoin, urlparse

from galaxy import exceptions as galaxy_exceptions
from galaxy.files.models import (
    AnyRemoteEntry,
    FilesSourceRuntimeContext,
    RemoteDirectory,
    RemoteFile,
)
from galaxy.files.sources._defaults import DEFAULT_SCHEME
from galaxy.files.sources._rdm import (
    ContainerAndFileIdentifier,
    RDMFileSourceConfiguration,
    RDMFileSourceTemplateConfiguration,
    RDMFilesSource,
    RDMRepositoryInteractor,
)
from galaxy.util import requests
from galaxy.util.config_templates import TemplateExpansion


OSF_DEFAULT_URL = "https://api.osf.io/v2/"
# `WATERBUTLER_URL` should either also be customizable or constructed from the
# OSF URL.
WATERBUTLER_URL = "https://files.osf.io/v1/"
DEFAULT_STORAGE = "osfstorage"
OSF_MAX_PAGE_SIZE = 100
CONNECT_TIMEOUT = 10
READ_TIMEOUT = 60
CHUNK_SIZE = 64 * 1024


class OSFFileSourceTemplateConfiguration(RDMFileSourceTemplateConfiguration):
    type: str = "osf"
    url: Union[str, TemplateExpansion] = OSF_DEFAULT_URL
    token: Union[str, TemplateExpansion]


class OSFFileSourceConfiguration(RDMFileSourceConfiguration):
    url: str = OSF_DEFAULT_URL
    token: str


class OSFFilesSourceException(ABC, Exception):
    """Abstract base for every exception raised by this plugin."""


class InvalidPath(galaxy_exceptions.MessageException, OSFFilesSourceException):
    """Path is malformed or not absolute."""


class ResourceNotFound(galaxy_exceptions.ObjectNotFound, OSFFilesSourceException):
    """A project, registration, or file does not exist in OSF."""


class DirectoryExpected(galaxy_exceptions.MessageException, OSFFilesSourceException, ValueError):
    """A file path was given where a directory was expected."""
    # this exception is not in use; it can be raised within `_list()` (or any
    # of the functions under it in the call stack)


class FileExpected(galaxy_exceptions.MessageException, OSFFilesSourceException, ValueError):
    """A directory path was given where a file was expected."""


class ValidationError(galaxy_exceptions.MessageException, OSFFilesSourceException):
    """OSF returned an unexpected or malformed response."""
    # this exception not in use either; it can be raised whenever OSF returns
    # a response that does not fit the expectations, although I would not
    # recommend focusing on this detail (it protects you from a very specific
    # kind of issue, i.e. OSF updates, that is not likely to occur, if at all)


class OSFClient:
    # Rename the class to `OSFClient` (no underscore), the module exports have
    # already been defined via `__all__ = ("OSFFilesSource",)`.

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/") + "/"

        # Please read the comments on `make_session()` and `make_headers()`
        # below. Since a lazy session object does not provide any benefit
        # and the session can be instantiated using just two lines, you can
        # create it now, when the class is instantiated, and forget about the
        # problem in the rest of your code.
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        })

    # The function `make_headers` is only called once, so it does not make
    # much sense to have it as a separate function, especially if it is just
    # one line long, its contents can be moved to `make_session()`.

    # Similarly, the function `make_session()` is only called in one kind of
    # situation: a session is not yet available, so it has to be created.
    # I have commented in previous meetings that it does not provide any
    # benefit to instantiate the session object lazily. The only purpose of an
    # `OSFClient` object is to make requests, so it will surely make use of
    # the session object during its lifetime; therefore there is no penalty if
    # it is created when the `__init__()` method runs: it's consuming exactly
    # the same amount of CPU cycles and memory to make a request.

    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        # here you save yourself the two lines of code because of early
        # session instantiation
        url = urljoin(self.base_url, endpoint)  # `urljoin` does it for you
        response = self._session.request(method, url, **kwargs)
        response.raise_for_status()  # nice
        return response.json()

    def list_projects(
        self,
        page: int = 1,
        page_size: int = OSF_MAX_PAGE_SIZE,
        query: Optional[str] = None,
        write_intent: bool = False,
        sort: Optional[str] = None,
    ) -> dict:
        # A significant value proposition of a file source plugin for an RDM
        # is sharing data: researchers should definitely be able to access not
        # just their projects, but also public projects.
        params: dict[str, Any] = {
            "filter[category]": "project",
            "page": page,
            "page[size]": page_size,
        }
        if query:
            params["filter[title]"] = query
        if write_intent:
            params["filter[current_user_permissions]"] = "write"  # nice
        if sort:
            params["sort"] = sort
        return self._request(
            "GET", "nodes/",
            # unfortunately, changing this breaks
            # `filter[current_user_permissions]`, so I am not sure what is the
            # best way to proceed
            params=params, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        )

    # Note that projects can have "components", and probably the
    # components can have subcomponents. A great option to let the user
    # interact with these structures is showing them as sub-folders of the
    # main project folder. As far as I see that is not implemented yet, it
    # should be implemented. I am not sure that a `list_node()` function is
    # the best approach, feel free to do something else.
    # EDIT: Probably we want to talk about this synchronously.
    def list_node(self):
        ...

    def list_registrations(
        self,
        page: int = 1,
        page_size: int = OSF_MAX_PAGE_SIZE,
        query: Optional[str] = None,
        sort: Optional[str] = None,
    ) -> dict:
        # Same story here, public registrations should also show up.
        params: dict[str, Any] = {
            "filter[category]": "project",
            "page": page,
            "page[size]": page_size,
        }
        if query:
            params["filter[title]"] = query
        if sort:
            params["sort"] = sort
        return self._request(
            "GET", "registrations/",
            params={"page": page, "page[size]": page_size},
            timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        )

    def list_files(
        self,
        page: int = 1,
        page_size: int = OSF_MAX_PAGE_SIZE,
        query: Optional[str] = None,
        sort: Optional[str] = None,
    ) -> dict:
        # Regardless of how it's implemented, the requirements specified that
        # files should also be directly browsable (REQ-1.1 and REQ-1.4).
        params: dict[str, Any] = {
            "page": page,
            "page[size]": page_size,
        }
        if query:
            params["filter[title]"] = query
        if sort:
            params["sort"] = sort
        return self._request(
            "GET", "search/files/",
            params={"page": page, "page[size]": page_size},
            timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        )

    # Renamed `create_node()` to `create_project()` to keep consistency across
    # all the abstractions that this class introduces, the `list_*()`
    # functions refer to the elements from the spec: projects, registrations and files.
    def create_project(
        self,
        title: str,
        description: str,
    ) -> dict:
        payload = {
            "data": {
                "type": "nodes",
                "attributes": {
                    "title": title,
                    "category": "project",
                    "public": False,
                    "description": description,
                },
            }
        }
        return self._request(
            "POST", "nodes/",
            json=payload, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        ).get("data", {})

    # WaterButler
    def waterbutler_url(self, container_id: str, wb_path: str = "/") -> str:
        if not wb_path.startswith("/"):
            wb_path = "/" + wb_path
        return urljoin(
            WATERBUTLER_URL,
            # Remember to take it as an extra option or to build it from the
            # OSF URL.
            f"resources/{container_id}/providers/{DEFAULT_STORAGE}{wb_path}",
        )

    def list_storage(self, container_id: str, wb_path: str = "/") -> list[dict]:
        # here you save yourself the two lines of code because of early
        # session instantiation
        url = self.waterbutler_url(container_id, wb_path)
        response = self._session.get(
            url, params={"meta": ""}, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        )
        response.raise_for_status()
        return response.json().get("data", [])

    def upload(
        self, container_id: str, folder_wb_path: str, filename: str, local_path: str,
    ) -> dict:
        # here you save yourself the two lines of code because of early
        # session instantiation
        url = self.waterbutler_url(container_id, folder_wb_path)
        params = {"kind": "file", "name": filename}
        with open(local_path, "rb") as f:
            response = self._session.put(
                url, params=params, data=f,
                timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
            )
        response.raise_for_status()
        return response.json()

    def download(self, container_id: str, wb_path: str, local_path: str) -> None:
        # here you save yourself the two lines of code because of early
        # session instantiation
        url = self.waterbutler_url(container_id, wb_path)
        try:
            # thanks for streaming the file rather than putting all of it in RAM
            with self._session.get(
                url, stream=True, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
            ) as response:
                response.raise_for_status()
                with open(local_path, "wb") as out:
                    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk:
                            out.write(chunk)
        except Exception:
            Path(local_path).unlink(missing_ok=True)
            raise


# Module exports have already been defined via `__all__ = ("OSFFilesSource",)`.
def has_parent(node: dict) -> bool:
    return node.get("relationships", {}).get("parent", {}).get("data") is not None

# Module exports have already been defined via `__all__ = ("OSFFilesSource",)`.
def node_title(node: dict) -> str:
    return node.get("attributes", {}).get("title", node.get("id", "untitled"))

# Module exports have already been defined via `__all__ = ("OSFFilesSource",)`.
def galaxy_pagination_to_osf(
    limit: Optional[int], offset: Optional[int],
) -> tuple[int, int]:
    """Translate Galaxy's (limit, offset) into OSF's (page, page[size]).

    OSF caps page[size] at OSF_MAX_PAGE_SIZE. When offset is not aligned to
    the page size, this returns the page that *contains* it (the framework
    trims; ``total`` is still accurate).
    """
    page_size = min(limit, OSF_MAX_PAGE_SIZE) if limit else OSF_MAX_PAGE_SIZE
    page = ((offset or 0) // page_size) + 1
    return page, page_size


# Module exports have already been defined via `__all__ = ("OSFFilesSource",)`.
def galaxy_sort_to_osf(sort_by: Optional[str]) -> Optional[str]:
    if not sort_by:
        return None
    return {
        "name": "title",
        "uri": "id",
        "path": "id",
        "ctime": "-date_modified",
        "size": "size",
    }.get(sort_by, "id")


class OSFRepositoryInteractor(RDMRepositoryInteractor):
    """OSF flavor of the RDM repository contract.

    A "container" is an OSF Project (GUID). Files inside a container are the
    files in its osfstorage, flattened (subfolder paths are encoded in
    ``file_identifier`` so downloads can find them again).
    """

    def to_plugin_uri(self, container_id: str, filename: Optional[str] = None) -> str:
        scheme = self.plugin.get_scheme()
        prefix = self.plugin.get_prefix() or ""  # this may lead to bugs but let's leave it as it is
        if filename:
            return f"{scheme}://{prefix}/{container_id}/{filename}"
        return f"{scheme}://{prefix}/{container_id}"

    def get_file_containers(
        self,
        context: FilesSourceRuntimeContext[RDMFileSourceConfiguration],
        write_intent: bool,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        query: Optional[str] = None,
        sort_by: Optional[str] = None,
    ) -> tuple[list[RemoteDirectory], int]:
        client = self._client(context)
        page, page_size = galaxy_pagination_to_osf(limit, offset)
        payload = client.list_projects(
            page=page,
            page_size=page_size,
            query=query,
            write_intent=write_intent,
            sort=galaxy_sort_to_osf(sort_by),
        )
        nodes = [n for n in payload.get("data", []) if not has_parent(n)]  # Again, the concept of "file container" does not play well with some reqs, in this case REQ-1.6, see comment I left within `OSFFilesSource._list()`.
        total = int(payload.get("links", {}).get("meta", {}).get("total", 0))
        # Nice, although for me the total is under `payload -> links -> meta -> total` (thus pagination was not working
        # for me, now it works). Under what circumstances does the API not return the total? In other words, could we
        # assume that the total is always there (and avoid using `.get()`)?
        # In addition, please note that the total is wrong, because even nodes for which `has_parent(n) == True` are
        # being filtered out, those are not being removed from the total (that can only solved by filtering them out on
        # the server).
        containers = [
            RemoteDirectory(
                name=node_title(node),
                uri=self.to_plugin_uri(node["id"]),
                path=f"/{node['id']}",
            )
            for node in nodes
            ]
        return containers, total

    def get_files_in_container(
        self,
        context: FilesSourceRuntimeContext[RDMFileSourceConfiguration],
        container_id: str,
        writeable: bool,
        query: Optional[str] = None,
    ) -> list[RemoteFile]:
        client = self._client(context)
        files = list(self._walk_files(client, container_id, wb_path="/", rel_prefix=""))
        if query:
            files = [f for f in files if query in f.get("name", "")]
        return files

    def create_draft_file_container(
        self,
        title: str,
        public_name: str,
        context: FilesSourceRuntimeContext[RDMFileSourceConfiguration],
    ) -> dict[str, Any]:
        return self._client(context).create_project(
            title=title,
            description=f"Created by Galaxy on behalf of {public_name}",
        )

    def upload_file_to_draft_container(
        self,
        container_id: str,
        filename: str,
        file_path: str,
        context: FilesSourceRuntimeContext[RDMFileSourceConfiguration],
    ) -> None:
        self._client(context).upload(container_id, "/", filename, file_path)

    def download_file_from_container(
        self,
        container_id: str,
        file_identifier: str,
        file_path: str,
        context: FilesSourceRuntimeContext[RDMFileSourceConfiguration],
    ) -> None:
        if not file_identifier:
            raise FileExpected("cannot download without a file identifier")
        client = self._client(context)
        leaf = self._walk_to(client, container_id, file_identifier.split("/"))
        if leaf.get("attributes", {}).get("kind") != "file":
            raise FileExpected(
                f"path {file_identifier!r} resolved to a folder, not a file"
            )
        client.download(container_id, leaf["attributes"]["path"], file_path)

    # private helpers
    def _client(self, context) -> OSFClient:
        return OSFClient(self.repository_url, context.config.token)

    def _walk_to(
        self, client: OSFClient, container_id: str, segments: list,
    ) -> dict:
        """Descend osfstorage segment-by-segment, matching on name.

        osfstorage addresses children by internal WaterButler IDs, not names,
        so we list each level, pick the named child, and descend using its
        ``attributes.path``.
        """
        # I wonder if there is a non-recursive approach available? (there
        # might not be). If there was, then that would greatly speed up this
        # process.
        current_path = "/"
        leaf: Optional[dict] = None
        for segment in segments:
            items = client.list_storage(container_id, current_path)
            match = next(
                (it for it in items if it.get("attributes", {}).get("name") == segment),
                None,
            )
            if match is None:
                raise ResourceNotFound(
                    f"No entry named {segment!r} in osfstorage:{current_path}"
                )
            leaf = match
            current_path = match["attributes"]["path"]
        if leaf is None:
            raise InvalidPath("walk called with empty segments")
        return leaf

    def _walk_files(
        self, client: OSFClient, container_id: str, wb_path: str, rel_prefix: str,
    ):
        for item in client.list_storage(container_id, wb_path):
            attrs = item.get("attributes", {})
            name = attrs.get("name", "untitled")
            kind = attrs.get("kind")
            rel_path = name if not rel_prefix else f"{rel_prefix}/{name}"
            # if `rel_prefix: str` is really true then `rel_path = name if not
            # rel_prefix else f"{rel_prefix}/{name}"` is enough
            if kind == "folder":
                # The problem with this approach is that it flattens the folder
                # hierarchy of projects. If I create a project with the
                # following structure,
                #   - /myfile.txt
                #   - /myfolder/myotherfile.txt
                # then I do not ever see "myfolder", but a flat project where
                # myfile.txt and myotherfile.txt are located on the same
                # place. That contravenes REQ-1.6.
                yield from self._walk_files(
                    client, container_id, attrs["path"], rel_path,
                )
            elif kind == "file":
                yield RemoteFile(**{
                    "name": name,
                    "uri": self.to_plugin_uri(container_id, rel_path),
                    "path": f"/{container_id}/{rel_path}",
                    "size": attrs.get("size", 0),
                    "ctime": attrs.get("modified_utc") or attrs.get("created_utc"),
                })


class OSFFilesSource(RDMFilesSource):
    plugin_type = "osf"
    supports_pagination = True
    supports_search = True
    supports_sorting = True

    template_config_class = OSFFileSourceTemplateConfiguration
    resolved_config_class = OSFFileSourceConfiguration

    def get_scheme(self) -> str:
        return (
            self.scheme
            if self.scheme and self.scheme != DEFAULT_SCHEME
            else "osf"
        )

    def get_prefix(self) -> Optional[str]:
        return self.id

    def score_url_match(self, url: str) -> int:
        parsed = urlparse(url)
        return sum(
            int(check)
            for check in (
                parsed.scheme == self.get_scheme(),
                parsed.netloc == self.get_prefix(),
            )
        )

    def to_relative_path(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path # `parsed.path` is an empty string when the URL does not contain a path
        if not path.startswith("/"):
            path = f"/{path}"
        return path

    # There are two ways file sources can be configured: via file-source
    # template or globally (although is being phased out). This function
    # allows you to decide whether a user should be able to access the
    # file source or not. This only makes sense if the file source is
    # defined globally. If you look at the implementation from the parent
    # class `BaseFilesSource`,
    # >>> if user_context is None and self.user_context_required:
    # >>>     return False
    # >>> return (
    # >>>     user_context is None
    # >>>     or user_context.is_admin
    # >>>     or (
    # >>>         self._user_has_required_roles(user_context)
    # >>>         and self._user_has_required_groups(user_context)
    # >>>     )
    # >>> )
    # it is a reasonable implementation based on Galaxy roles and groups,
    # whether the user is an admin, etc. It should be safe to remove your
    # implementation of the function and let the parent class do its job.

    # RDM contract
    def get_repository_interactor(self, repository_url: str) -> OSFRepositoryInteractor:
        return OSFRepositoryInteractor(repository_url=repository_url, plugin=self)

    def parse_path(
        self, source_path: str, container_id_only: bool = False,
    ) -> ContainerAndFileIdentifier:
        """Split a plugin path into (container_id, file_identifier).

        "/"                          -> ("", "")
        "/abc12"                     -> ("abc12", "")
        "/abc12/data.csv"            -> ("abc12", "data.csv")
        "/abc12/folder/sub/a.csv"    -> ("abc12", "folder/sub/a.csv")
        """
        # nice example
        #
        # Recall REQ-1.1: "The top level of the hierarchy shall contain one
        # folder per supported entity category: Projects, Registrations and
        # Files". Those top-level folders are not shown when using this
        # approach (they should be "fake" folders) and it does no cover files.
        path_obj = Path(source_path)
        if not path_obj.is_absolute():
            raise InvalidPath(
                f"Path must be absolute (start with '/'): {source_path!r}"
            )
        parts = path_obj.parts[1:]
        if not parts:
            return ContainerAndFileIdentifier(container_id="", file_identifier="")
        container_id = parts[0]
        if container_id_only or len(parts) == 1:
            return ContainerAndFileIdentifier(
                container_id=container_id, file_identifier="",
            )
        return ContainerAndFileIdentifier(
            container_id=container_id, file_identifier="/".join(parts[1:]),
        )

    def get_container_id_from_path(self, source_path: str) -> str:
        return self.parse_path(source_path, container_id_only=True).container_id

    # Galaxy contract
    def _list(
        self,
        context: FilesSourceRuntimeContext[OSFFileSourceConfiguration],
        path: str = "/",
        recursive: bool = False,
        write_intent: bool = False,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        query: Optional[str] = None,
        sort_by: Optional[str] = None,
    ) -> tuple[list[AnyRemoteEntry], int]:
        # Recall REQ-1.1: "The top level of the hierarchy shall contain one
        # folder per supported entity category: Projects, Registrations and
        # Files". It does not play well with the concept of "file container",
        # but life is hard. Possibly that concept of "file container" should
        # be associated only with projects and registrations, but not
        # individual files. You will have to figure out how to deal with these
        # two types of containers in an "efficient" way all while having a
        # third type of entity that is "loose" (the files). Nevertheless, take
        # into account that this idea of "file container" is more "aesthetic"
        # than anything else, because the `RDMFilesSource` does NOT rely on
        # them as one may think it would (e.g. it doesn't call
        # `get_file_container()`), but rather the actual implementations such
        # as Invenio or Dataverse do. That means there is a lot of freedom to
        # "sidestep" this concept whenever necessary in the OSF
        # implementation. You can take some inspiration from the eLabFTW
        # implementation on how to display the three fake fixed folders for
        # each category.
        container_id = self.parse_path(path).container_id
        if not container_id:
            return self.repository.get_file_containers(
                context, write_intent, limit, offset, query, sort_by,
            )
        files = self.repository.get_files_in_container(
            context, container_id, writeable=write_intent, query=query,
        )
        return files, len(files)

    def _realize_to(
        self,
        source_path: str,
        native_path: str,
        context: FilesSourceRuntimeContext[OSFFileSourceConfiguration],
    ) -> None:
        identifier = self.parse_path(source_path)
        self.repository.download_file_from_container(
            identifier.container_id, identifier.file_identifier, native_path, context,
        )

    def _write_from(
        self,
        target_path: str,
        native_path: str,
        context: FilesSourceRuntimeContext[OSFFileSourceConfiguration],
    ) -> str:
        identifier = self.parse_path(target_path)
        self.repository.upload_file_to_draft_container(
            identifier.container_id, identifier.file_identifier, native_path, context,
        )
        return target_path

    # `def _create_entry(...)` should be defined to be able to create the draft container

__all__ = ("OSFFilesSource",)
