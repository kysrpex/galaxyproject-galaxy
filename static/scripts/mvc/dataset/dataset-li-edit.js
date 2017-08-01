"use strict";define(["mvc/dataset/states","mvc/dataset/dataset-li","mvc/tag","mvc/annotation","ui/fa-icon-button","mvc/base-mvc","utils/localization"],function(t,e,i,n,a,r,o){var s=e.DatasetListItemView,l=s.extend({initialize:function(t){s.prototype.initialize.call(this,t),this.hasUser=t.hasUser,this.purgeAllowed=t.purgeAllowed||!1,this.tagsEditorShown=t.tagsEditorShown||!1,this.annotationEditorShown=t.annotationEditorShown||!1},_renderPrimaryActions:function(){var e=s.prototype._renderPrimaryActions.call(this);return this.model.get("state")===t.NOT_VIEWABLE?e:s.prototype._renderPrimaryActions.call(this).concat([this._renderEditButton(),this._renderDeleteButton()])},_renderEditButton:function(){if(this.model.get("state")===t.DISCARDED||!this.model.get("accessible"))return null;var e=this.model.get("purged"),i=this.model.get("deleted"),n={title:o("Edit attributes"),href:this.model.urls.edit,target:this.linkTarget,faIcon:"fa-pencil",classes:"edit-btn"};return i||e?(n.disabled=!0,e?n.title=o("Cannot edit attributes of datasets removed from disk"):i&&(n.title=o("Undelete dataset to edit attributes"))):_.contains([t.UPLOAD,t.NEW],this.model.get("state"))&&(n.disabled=!0,n.title=o("This dataset is not yet editable")),a(n)},_renderDeleteButton:function(){if(!this.model.get("accessible"))return null;var t=this,e=this.model.isDeletedOrPurged();return a({title:o(e?"Dataset is already deleted":"Delete"),disabled:e,faIcon:"fa-times",classes:"delete-btn",onclick:function(){t.$el.find(".icon-btn.delete-btn").trigger("mouseout"),t.model.delete()}})},_renderDetails:function(){var e=s.prototype._renderDetails.call(this),i=this.model.get("state");return!this.model.isDeletedOrPurged()&&_.contains([t.OK,t.FAILED_METADATA],i)&&(this._renderTags(e),this._renderAnnotation(e),this._makeDbkeyEditLink(e)),this._setUpBehaviors(e),e},_renderToolHelpButton:function(){var t=this.model.attributes.dataset_id,e=this.model.attributes.creating_job,i=this,n=function(e){var n='<div id="thdiv-'+t+'" class="toolhelp">';e.name&&e.help?(n+="<strong>Tool help for "+e.name+"</strong><hr/>",n+=e.help):n+="<strong>Tool help is unavailable for this dataset.</strong><hr/>",n+="</div>",i.$el.find(".details").append($.parseHTML(n))},r=function(t){$.ajax({url:Galaxy.root+"api/tools/"+t.tool_id+"/build"}).done(function(t){n(t)}).fail(function(){n({})})};return null===Galaxy.user.id?null:a({title:o("Tool Help"),classes:"icon-btn",href:"#",faIcon:"fa-question",onclick:function(){i.$el.find(".toolhelp").length>0?i.$el.find(".toolhelp").toggle():$.ajax({url:Galaxy.root+"api/jobs/"+e}).done(function(t){r(t)}).fail(function(){console.log('Failed at recovering job information from the  Galaxy API for job id "'+e+'".')})}})},_renderSecondaryActions:function(){var e=s.prototype._renderSecondaryActions.call(this);switch(this.model.get("state")){case t.UPLOAD:case t.NOT_VIEWABLE:return e;case t.ERROR:return e.unshift(this._renderErrButton()),e.concat([this._renderRerunButton(),this._renderToolHelpButton()]);case t.OK:case t.FAILED_METADATA:return e.concat([this._renderRerunButton(),this._renderVisualizationsButton(),this._renderToolHelpButton()])}return e.concat([this._renderRerunButton(),this._renderToolHelpButton()])},_renderErrButton:function(){return a({title:o("View or report this error"),href:this.model.urls.report_error,classes:"report-error-btn",target:this.linkTarget,faIcon:"fa-bug"})},_renderRerunButton:function(){var t=this.model.get("creating_job");if(this.model.get("rerunnable"))return a({title:o("Run this job again"),href:this.model.urls.rerun,classes:"rerun-btn",target:this.linkTarget,faIcon:"fa-refresh",onclick:function(e){e.preventDefault(),Galaxy.router.push("/",{job_id:t})}})},_renderVisualizationsButton:function(){var t=this.model.get("visualizations");if(this.model.isDeletedOrPurged()||!this.hasUser||!this.model.hasData()||_.isEmpty(t))return null;if(!_.isObject(t[0]))return this.warn("Visualizations have been switched off"),null;var e=$(this.templates.visualizations(t,this));return e.find('[target="galaxy_main"]').attr("target",this.linkTarget),this._addScratchBookFn(e.find(".visualization-link").addBack(".visualization-link")),e},_addScratchBookFn:function(t){t.click(function(t){Galaxy.frame&&Galaxy.frame.active&&(Galaxy.frame.add({title:"Visualization",url:$(this).attr("href")}),t.preventDefault(),t.stopPropagation())})},_renderTags:function(t){if(this.hasUser){var e=this;this.tagsEditor=new i.TagsEditor({model:this.model,el:t.find(".tags-display"),onshowFirstTime:function(){this.render()},onshow:function(){e.tagsEditorShown=!0},onhide:function(){e.tagsEditorShown=!1},$activator:a({title:o("Edit dataset tags"),classes:"tag-btn",faIcon:"fa-tags"}).appendTo(t.find(".actions .right"))}),this.tagsEditorShown&&this.tagsEditor.toggle(!0)}},_renderAnnotation:function(t){if(this.hasUser){var e=this;this.annotationEditor=new n.AnnotationEditor({model:this.model,el:t.find(".annotation-display"),onshowFirstTime:function(){this.render()},onshow:function(){e.annotationEditorShown=!0},onhide:function(){e.annotationEditorShown=!1},$activator:a({title:o("Edit dataset annotation"),classes:"annotate-btn",faIcon:"fa-comment"}).appendTo(t.find(".actions .right"))}),this.annotationEditorShown&&this.annotationEditor.toggle(!0)}},_makeDbkeyEditLink:function(t){if("?"===this.model.get("metadata_dbkey")&&!this.model.isDeletedOrPurged()){var e=$('<a class="value">?</a>').attr("href",this.model.urls.edit).attr("target",this.linkTarget);t.find(".dbkey .value").replaceWith(e)}},events:_.extend(_.clone(s.prototype.events),{"click .undelete-link":"_clickUndeleteLink","click .purge-link":"_clickPurgeLink","click .edit-btn":function(t){this.trigger("edit",this,t)},"click .delete-btn":function(t){this.trigger("delete",this,t)},"click .rerun-btn":function(t){this.trigger("rerun",this,t)},"click .report-err-btn":function(t){this.trigger("report-err",this,t)},"click .visualization-btn":function(t){this.trigger("visualize",this,t)},"click .dbkey a":function(t){this.trigger("edit",this,t)}}),_clickUndeleteLink:function(t){return this.model.undelete(),!1},_clickPurgeLink:function(t){return confirm(o("This will permanently remove the data in your dataset. Are you sure?"))&&this.model.purge(),!1},toString:function(){return"HDAEditView("+(this.model?this.model+"":"(no model)")+")"}});return l.prototype.templates=function(){var t=_.extend({},s.prototype.templates.warnings,{failed_metadata:r.wrapTemplate(['<% if( dataset.state === "failed_metadata" ){ %>','<div class="failed_metadata-warning warningmessagesmall">',o("An error occurred setting the metadata for this dataset"),'<br /><a href="<%- dataset.urls.edit %>" target="<%- view.linkTarget %>">',o("Set it manually or retry auto-detection"),"</a>","</div>","<% } %>"],"dataset"),deleted:r.wrapTemplate(["<% if( dataset.deleted && !dataset.purged ){ %>",'<div class="deleted-msg warningmessagesmall">',o("This dataset has been deleted"),'<br /><a class="undelete-link" href="javascript:void(0);">',o("Undelete it"),"</a>","<% if( view.purgeAllowed ){ %>",'<br /><a class="purge-link" href="javascript:void(0);">',o("Permanently remove it from disk"),"</a>","<% } %>","</div>","<% } %>"],"dataset")}),e=r.wrapTemplate(["<% if( visualizations.length === 1 ){ %>",'<a class="visualization-link icon-btn" href="<%- visualizations[0].href %>"',' target="<%- visualizations[0].target %>" title="',o("Visualize in"),' <%- visualizations[0].html %>">','<span class="fa fa-bar-chart-o"></span>',"</a>","<% } else { %>",'<div class="visualizations-dropdown dropdown icon-btn">','<a data-toggle="dropdown" title="',o("Visualize"),'">','<span class="fa fa-bar-chart-o"></span>',"</a>",'<ul class="dropdown-menu" role="menu">',"<% _.each( visualizations, function( visualization ){ %>",'<li><a class="visualization-link" href="<%- visualization.href %>"',' target="<%- visualization.target %>">',"<%- visualization.html %>","</a></li>","<% }); %>","</ul>","</div>","<% } %>"],"visualizations");return _.extend({},s.prototype.templates,{warnings:t,visualizations:e})}(),{DatasetListItemEdit:l}});
//# sourceMappingURL=../../../maps/mvc/dataset/dataset-li-edit.js.map
