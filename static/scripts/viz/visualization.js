"use strict";define(["libs/underscore","mvc/dataset/data","viz/trackster/util","utils/config","mvc/grid/grid-view","mvc/ui/ui-tabs","mvc/ui/ui-misc"],function(t,e,a,n,i,r,s){var o={toJSON:function(){var e=this,a={};return t.each(e.constructor.to_json_keys,function(t){var n=e.get(t);t in e.constructor.to_json_mappers&&(n=e.constructor.to_json_mappers[t](n,e)),a[t]=n}),a}},d=function(t,e){var a=new i({url_base:Galaxy.root+"visualization/list_history_datasets",filters:t,dict_format:!0,embedded:!0}),n=new i({url_base:Galaxy.root+"visualization/list_library_datasets",dict_format:!0,embedded:!0}),s=new r.View;s.add({id:"histories",title:"Histories",$el:$("<div/>").append(a.$el)}),s.add({id:"libraries",title:"Libraries",$el:$("<div/>").append(n.$el)}),Galaxy.modal.show({title:"Select datasets for new tracks",body:s.$el,closing_events:!0,buttons:{Cancel:function(){Galaxy.modal.hide()},Add:function(){var t=[];s.$("input.grid-row-select-checkbox[name=id]:checked").each(function(){window.console.log($(this).val()),t[t.length]=$.ajax({url:Galaxy.root+"api/datasets/"+$(this).val(),dataType:"json",data:{data_type:"track_config",hda_ldda:"histories"==s.current()?"hda":"ldda"}})}),$.when.apply($,t).then(function(){var t=arguments[0]instanceof Array?$.map(arguments,function(t){return t[0]}):[arguments[0]];e(t)}),Galaxy.modal.hide()}}})},l=function(t){this.default_font=void 0!==t?t:"9px Monaco, Lucida Console, monospace",this.dummy_canvas=this.new_canvas(),this.dummy_context=this.dummy_canvas.getContext("2d"),this.dummy_context.font=this.default_font,this.char_width_px=this.dummy_context.measureText("A").width,this.patterns={},this.load_pattern("right_strand","/visualization/strand_right.png"),this.load_pattern("left_strand","/visualization/strand_left.png"),this.load_pattern("right_strand_inv","/visualization/strand_right_inv.png"),this.load_pattern("left_strand_inv","/visualization/strand_left_inv.png")};t.extend(l.prototype,{load_pattern:function(t,e){var a=this.patterns,n=this.dummy_context,i=new Image;i.src=Galaxy.root+"static/images"+e,i.onload=function(){a[t]=n.createPattern(i,"repeat")}},get_pattern:function(t){return this.patterns[t]},new_canvas:function(){var t=$("<canvas/>")[0];return t.manager=this,t}});var u=Backbone.Model.extend({defaults:{num_elements:20,obj_cache:null,key_ary:null},initialize:function(t){this.clear()},get_elt:function(e){var a=this.attributes.obj_cache,n=this.attributes.key_ary,i=e.toString(),r=t.indexOf(n,function(t){return t.toString()===i});return-1!==r&&(a[i].stale?(n.splice(r,1),delete a[i]):this.move_key_to_end(e,r)),a[i]},set_elt:function(t,e){var a=this.attributes.obj_cache,n=this.attributes.key_ary,i=t.toString(),r=this.attributes.num_elements;if(!a[i]){if(n.length>=r){delete a[n.shift().toString()]}n.push(t)}return a[i]=e,e},move_key_to_end:function(t,e){this.attributes.key_ary.splice(e,1),this.attributes.key_ary.push(t)},clear:function(){this.attributes.obj_cache={},this.attributes.key_ary=[]},size:function(){return this.attributes.key_ary.length},most_recently_added:function(){return 0===this.size()?null:this.attributes.key_ary[this.attributes.key_ary.length-1]}}),_=u.extend({defaults:t.extend({},u.prototype.defaults,{dataset:null,genome:null,init_data:null,min_region_size:200,filters_manager:null,data_type:"data",data_mode_compatible:function(t,e){return!0},can_subset:function(t){return!1}}),initialize:function(t){u.prototype.initialize.call(this);var e=this.get("init_data");e&&this.add_data(e)},add_data:function(e){this.get("num_elements")<e.length&&this.set("num_elements",e.length);var a=this;t.each(e,function(t){a.set_data(t.region,t)})},data_is_ready:function(){var t=this.get("dataset"),e=$.Deferred(),n="raw_data"===this.get("data_type")?"state":"data"===this.get("data_type")?"converted_datasets_state":"error",i=new a.ServerStateDeferred({ajax_settings:{url:this.get("dataset").url(),data:{hda_ldda:t.get("hda_ldda"),data_type:n},dataType:"json"},interval:5e3,success_fn:function(t){return"pending"!==t}});return $.when(i.go()).then(function(t){e.resolve("ok"===t||"data"===t)}),e},search_features:function(t){var e=this.get("dataset"),a={query:t,hda_ldda:e.get("hda_ldda"),data_type:"features"};return $.getJSON(e.url(),a)},load_data:function(t,e,a,n){var i=this.get("dataset"),r={data_type:this.get("data_type"),chrom:t.get("chrom"),low:t.get("start"),high:t.get("end"),mode:e,resolution:a,hda_ldda:i.get("hda_ldda")};$.extend(r,n);var s=this.get("filters_manager");if(s){for(var o=[],d=s.filters,l=0;l<d.length;l++)o.push(d[l].name);r.filter_cols=JSON.stringify(o)}var u=this,_=$.getJSON(i.url(),r,function(e){e.region=t,u.set_data(t,e)});return this.set_data(t,_),_},get_data:function(t,e,n,i){var r=this.get_elt(t);if(r&&(a.is_deferred(r)||this.get("data_mode_compatible")(r,e)))return r;for(var s,o,d=this.get("key_ary"),l=this.get("obj_cache"),u=0;u<d.length;u++)if(s=d[u],s.contains(t)&&(o=!0,r=l[s.toString()],a.is_deferred(r)||this.get("data_mode_compatible")(r,e)&&this.get("can_subset")(r))){if(this.move_key_to_end(s,u),!a.is_deferred(r)){var _=this.subset_entry(r,t);this.set_data(t,_),r=_}return r}if(!o&&t.length()<this.attributes.min_region_size){t=t.copy();var c=this.most_recently_added();!c||t.get("start")>c.get("start")?t.set("end",t.get("start")+this.attributes.min_region_size):t.set("start",t.get("end")-this.attributes.min_region_size),t.set("genome",this.attributes.genome),t.trim()}return this.load_data(t,e,n,i)},set_data:function(t,e){this.set_elt(t,e)},DEEP_DATA_REQ:"deep",BROAD_DATA_REQ:"breadth",get_more_data:function(t,e,a,n,i){var r=this._mark_stale(t);if(!r||!this.get("data_mode_compatible")(r,e))return void console.log("ERROR: problem with getting more data: current data is not compatible");var s=t.get("start");i===this.DEEP_DATA_REQ?$.extend(n,{start_val:r.data.length+1}):i===this.BROAD_DATA_REQ&&(s=(r.max_high?r.max_high:r.data[r.data.length-1][2])+1);var o=t.copy().set("start",s),d=this,l=this.load_data(o,e,a,n),u=$.Deferred();return this.set_data(t,u),$.when(l).then(function(e){e.data&&(e.data=r.data.concat(e.data),e.max_low&&(e.max_low=r.max_low),e.message&&(e.message=e.message.replace(/[0-9]+/,e.data.length))),d.set_data(t,e),u.resolve(e)}),u},can_get_more_detailed_data:function(t){var e=this.get_elt(t);return"bigwig"===e.dataset_type&&e.data.length<8e3},get_more_detailed_data:function(t,e,a,n,i){var r=this._mark_stale(t);return r?(i||(i={}),"bigwig"===r.dataset_type&&(i.num_samples=1e3*n),this.load_data(t,e,a,i)):void console.log("ERROR getting more detailed data: no current data")},_mark_stale:function(t){var e=this.get_elt(t);return e||console.log("ERROR: no data to mark as stale: ",this.get("dataset"),t.toString()),e.stale=!0,e},get_genome_wide_data:function(e){var a=this,n=!0,i=t.map(e.get("chroms_info").chrom_info,function(t){var e=a.get_elt(new g({chrom:t.chrom,start:0,end:t.len}));return e||(n=!1),e});if(n)return i;var r=$.Deferred();return $.getJSON(this.get("dataset").url(),{data_type:"genome_data"},function(t){a.add_data(t.data),r.resolve(t.data)}),r},subset_entry:function(e,a){var n={bigwig:function(e,a){return t.filter(e,function(t){return t[0]>=a.get("start")&&t[0]<=a.get("end")})},refseq:function(t,a){var n=a.get("start")-e.region.get("start");return e.data.slice(n,n+a.length())}},i=e.data;return!e.region.same(a)&&e.dataset_type in n&&(i=n[e.dataset_type](e.data,a)),{region:a,data:i,dataset_type:e.dataset_type}}}),c=_.extend({initialize:function(t){var e=new Backbone.Model;e.urlRoot=t.data_url,this.set("dataset",e)},load_data:function(t,e,a,n){return t.length()<=1e5?_.prototype.load_data.call(this,t,e,a,n):{data:null,region:t}}}),h=Backbone.Model.extend({defaults:{name:null,key:null,chroms_info:null},initialize:function(t){this.id=t.dbkey},get_chroms_info:function(){return this.attributes.chroms_info.chrom_info},get_chrom_region:function(e){var a=t.find(this.get_chroms_info(),function(t){return t.chrom===e});return new g({chrom:a.chrom,end:a.len})},get_chrom_len:function(e){return t.find(this.get_chroms_info(),function(t){return t.chrom===e}).len}}),g=Backbone.Model.extend({defaults:{chrom:null,start:0,end:0,str_val:null,genome:null},same:function(t){return this.attributes.chrom===t.get("chrom")&&this.attributes.start===t.get("start")&&this.attributes.end===t.get("end")},initialize:function(t){if(t.from_str){var e=t.from_str.split(":"),a=e[0],n=e[1].split("-");this.set({chrom:a,start:parseInt(n[0],10),end:parseInt(n[1],10)})}this.attributes.str_val=this.get("chrom")+":"+this.get("start")+"-"+this.get("end"),this.on("change",function(){this.attributes.str_val=this.get("chrom")+":"+this.get("start")+"-"+this.get("end")},this)},copy:function(){return new g({chrom:this.get("chrom"),start:this.get("start"),end:this.get("end")})},length:function(){return this.get("end")-this.get("start")},toString:function(){return this.attributes.str_val},toJSON:function(){return{chrom:this.get("chrom"),start:this.get("start"),end:this.get("end")}},compute_overlap:function(t){var e=this.get("chrom"),a=t.get("chrom"),n=this.get("start"),i=t.get("start"),r=this.get("end"),s=t.get("end");return e&&a&&e!==a?g.overlap_results.DIF_CHROMS:n<i?r<i?g.overlap_results.BEFORE:r<s?g.overlap_results.OVERLAP_START:g.overlap_results.CONTAINS:n>i?n>s?g.overlap_results.AFTER:r<=s?g.overlap_results.CONTAINED_BY:g.overlap_results.OVERLAP_END:r>=s?g.overlap_results.CONTAINS:g.overlap_results.CONTAINED_BY},trim:function(t){if(this.attributes.start<0&&(this.attributes.start=0),this.attributes.genome){var e=this.attributes.genome.get_chrom_len(this.attributes.chrom);this.attributes.end>e&&(this.attributes.end=e-1)}return this},contains:function(t){return this.compute_overlap(t)===g.overlap_results.CONTAINS},overlaps:function(e){return 0===t.intersection([this.compute_overlap(e)],[g.overlap_results.DIF_CHROMS,g.overlap_results.BEFORE,g.overlap_results.AFTER]).length}},{overlap_results:{DIF_CHROMS:1e3,BEFORE:1001,CONTAINS:1002,OVERLAP_START:1003,OVERLAP_END:1004,CONTAINED_BY:1005,AFTER:1006}}),f=Backbone.Collection.extend({model:g}),m=Backbone.Model.extend({defaults:{region:null,note:""},initialize:function(t){this.set("region",new g(t.region))}}),v=Backbone.Collection.extend({model:m}),p=Backbone.Model.extend(o).extend({defaults:{mode:"Auto"},initialize:function(t){this.set("dataset",new e.Dataset(t.dataset));var a=[{key:"name",default_value:this.get("dataset").get("name")},{key:"color"},{key:"min_value",label:"Min Value",type:"float",default_value:0},{key:"max_value",label:"Max Value",type:"float",default_value:1}];this.set("config",n.ConfigSettingCollection.from_models_and_saved_values(a,t.prefs));var i=this.get("preloaded_data");i=i?i.data:[],this.set("data_manager",new _({dataset:this.get("dataset"),init_data:i}))}},{to_json_keys:["track_type","dataset","prefs","mode","filters","tool_state"],to_json_mappers:{prefs:function(e,a){return 0===t.size(e)&&(e={name:a.get("config").get("name").get("value"),color:a.get("config").get("color").get("value")}),e},dataset:function(t){return{id:t.id,hda_ldda:t.get("hda_ldda")}}}}),y=Backbone.Collection.extend({model:p}),b=Backbone.Model.extend({defaults:{title:"",type:""},urlRoot:Galaxy.root+"api/visualizations",save:function(){return $.ajax({url:this.url(),type:"POST",dataType:"json",data:{vis_json:JSON.stringify(this)}})}}),k=b.extend(o).extend({defaults:t.extend({},b.prototype.defaults,{dbkey:"",drawables:null,bookmarks:null,viewport:null}),initialize:function(t){this.set("drawables",new y(t.tracks));var e=[];this.set("config",n.ConfigSettingCollection.from_models_and_saved_values(e,t.prefs)),this.unset("tracks"),this.get("drawables").each(function(t){t.unset("preloaded_data")})},add_tracks:function(t){this.get("drawables").add(t)}},{to_json_keys:["view","viewport","bookmarks"],to_json_mappers:{view:function(t,e){return{obj_type:"View",prefs:{name:e.get("title"),content_visible:!0},drawables:e.get("drawables")}}}}),w=Backbone.Router.extend({initialize:function(t){this.view=t.view,this.route(/([\w]+)$/,"change_location"),this.route(/([\w\+]+\:[\d,]+-[\d,]+)$/,"change_location");var e=this;e.view.on("navigate",function(t){e.navigate(t)})},change_location:function(t){this.view.go_to(t)}});return{BackboneTrack:p,BrowserBookmark:m,BrowserBookmarkCollection:v,Cache:u,CanvasManager:l,Genome:h,GenomeDataManager:_,GenomeRegion:g,GenomeRegionCollection:f,GenomeVisualization:k,GenomeReferenceDataManager:c,TrackBrowserRouter:w,Visualization:b,select_datasets:d}});
//# sourceMappingURL=../../maps/viz/visualization.js.map
