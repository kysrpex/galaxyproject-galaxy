"use strict";function append_notebook(e){clear_main_area(),$("#main").append('<iframe frameBorder="0" seamless="seamless" style="width: 100%; height: 100%; overflow:hidden;" scrolling="no" src="'+e+'"></iframe>')}function clear_main_area(){$("#spinner").remove(),$("#main").children().remove()}function display_spinner(){$("#main").append('<img id="spinner" src="'+galaxy_root+'static/style/largespinner.gif" style="position:absolute;margin:auto;top:0;left:0;right:0;bottom:0;">')}function not_ready(e,t,n,r){0==t.count&&(display_spinner(),toastr.info("Galaxy is launching a container in which to run this interactive environment. Please wait...",{closeButton:!0,tapToDismiss:!1})),t.count++,t.time<n&&(t.time+=r),console.log("Readiness request "+t.count+" sleeping "+t.time/1e3+"s"),window.setTimeout(e,t.time)}function load_when_ready(e,t){var n=500,r={time:1e3,count:0},a=function a(){$.ajax({url:e,xhrFields:{withCredentials:!0},type:"GET",timeout:n,dataType:"json",success:function(e){1==e?(console.log("Galaxy reports IE container ready, returning"),clear_main_area(),toastr.clear(),t()):0==e?not_ready(a,r,15e3,1e3):(clear_main_area(),toastr.clear(),toastr.error("Galaxy failed to launch a container in which to run this interactive environment, contact your administrator.","Error",{closeButton:!0,tapToDismiss:!1}))},error:function(e,t,i){"timeout"==t?(n<1e4&&(n+=250),not_ready(a,r,15e3,1e3)):(clear_main_area(),toastr.clear(),toastr.error("Galaxy encountered an error while attempting to determine the readiness of this interactive environment, contact your administrator.","Error",{closeButton:!0,tapToDismiss:!1}))}})};window.setTimeout(a,r.time)}function test_ie_availability(e,t){var n=0;display_spinner(),interval=setInterval(function(){$.ajax({url:e,xhrFields:{withCredentials:!0},type:"GET",timeout:500,success:function(){console.log("Connected to IE, returning"),clearInterval(interval),t()},error:function(e,t,r){n++,console.log("Availability request "+n),n>30&&(clearInterval(interval),clear_main_area(),toastr.error("Could not connect to IE, contact your administrator","Error",{closeButton:!0,timeOut:2e4,tapToDismiss:!1}))}})},1e3)}
//# sourceMappingURL=../maps/galaxy.interactive_environments.js.map
