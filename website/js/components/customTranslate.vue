<template lang='pug'>
  v-container(column grid-list-md id="page-import")
    v-layout(column)
      v-flex
        v-card
          v-card-title.display-1.pa-2 Import Translate Custom Terminologies
          v-card-text
            h3 For more information about Amazon Translate custom terminologies, see <a href="https://github.com/aws-samples/aws-ai-qna-bot/blob/master/docs/customer_terminology_guide/README.md" target="_blank">here</a>
          v-card-text(v-if="!IsCustomTerminologyEnabled")
            p Set ENABLE_CUSTOM_TERMINOLOGY to true in settings to enable the use of terminology files for Amazon Translate

          v-card-text(v-if="IsCustomTerminologyEnabled") 
            p {{importWarning}}  
            p.title From File
            <span>Description:</span>
            <br/>
            <textarea v-model="description" placeholder="Give a description for your file."></textarea>
            <br/>
            div.ml-4.mb-2
              input(
                type="file" 
                name="file"
                id="upload-file" 
                v-on:change="Getfile"
                ref="file"
              )
            <br/>
            p {{uploadStatus}}
      v-flex(v-if="jobs.length>0 && IsCustomTerminologyEnabled")
        v-card(id="import-jobs")
          v-card-title.headline Installed Translate Custom Terminologies
          v-card-text
              table.table
                tr
                  th(style="text-align:left") Name
                  th(style="text-align:left") Description
                  th(style="text-align:left") Source Language
                  th(style="text-align:left") Target Languages
                  th(style="text-align:left") Number Of Terms

                template(v-for="(job,index) in jobs")
                    tr
                      td {{job.Name}}
                      td {{job.Description}}
                      td {{job.SourceLanguage}}
                      td {{job.TargetLanguageCodes.join()}}
                      td {{job.TermCount}}



</template>

<script>
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

var Vuex=require('vuex')
var Promise=require('bluebird')
var saveAs=require('file-saver').saveAs
var axios=require('axios')
const parseJson = require('json-parse-better-errors')

var _=require('lodash')

module.exports={
  data:function(){
    var self=this
    return {
      importWarning:"Warning, Importing will over write existing translations with the same ID",
      loading:false,
      testing:false,
      url:"",
      error:"",
      success:'',
      description:null,
      jobs:[],
      examples:[],
      uploadStatus:"",
      IsCustomTerminologyEnabled: false,

    }
  },
  components:{
  },
  computed:{
  },
  updated: function () {
    var self = this;
    this.CustomTerminologyIsEnabled().then((data) => {
      self.IsCustomTerminologyEnabled = data;
    });
  },
  created:async function(){
    this.refresh()
    var examples=await this.$store.dispatch('api/listExamples')
    this.examples=examples
  },
  methods:{
    CustomTerminologyIsEnabled: async function(){
        const settings=await this.$store.dispatch('api/listSettings');
        console.log(JSON.stringify(settings));
        return _.get(settings[2],"ENABLE_CUSTOM_TERMINOLOGY")=="true"
    },
    
    close:function(){
      this.loading=false
      this.error=false
    },

    refresh:function(index){
      var self=this
      if(index===undefined){
        self.jobs=[]
        return this.$store.dispatch('api/getTerminologies')
        .then(result=>{
          self.jobs = result
        })
        
      }
    },
    Getfile:function(event){
      var self=this
      this.loading=true
      var files_raw=self.$refs.file.files
      var files=[]
      for(var i=0;i<files_raw.length;i++){
        files.push(files_raw[i])
      }
      Promise.all(files.map(file=>{
        var name=file.name
        return new Promise(function(res,rej){
          var reader = new FileReader();
          reader.onload = function(e){ 
            try {
              res({
                name:file.name,
                data:e.target.result
              })
            } catch(e) {
              rej(e)
            }
          };
          reader.readAsText(file);
        })
      }))
      .map(result=>self.upload(result.data,result.name))
      .catch(e=>{
        console.log(e)
        self.error=e.message
      })
    },
    upload:function(data,nam){
      var self=this
      var id=nam.replace(' ' ,'-')
      // reader.readAsDataURL(file);
      console.log("data:", data)
      new Promise(function(res,rej){
        console.log(data)
        if(data){
          self.$store.dispatch('api/startImportTranslate',{
            name:nam.split('.')[0],
            description:self.description,
            file:btoa(data),
          })
          .then(res)
          .catch(rej)
        }else{
          rej('Invalid or Empty File')
        }
      })
      .then((data)=>{
        self.uploadStatus = `Status: ${data.Status}:${data.Error}`
        self.refresh();
      })
      .tapCatch(console.log)
      .catch(error=>self.error=error)
    },
  }
}
</script>

<style lang='scss' scoped>
  .job-content {
    flex:1;
  }

  .job-actions {
    flex:0;
    flex-direction:row;
  }
</style>
