<template lang="pug">
  v-dialog(v-model='dialog' persistent max-width='50%')
    template
      v-btn.block(flat slot="activator" :disabled="!(kendraIndexerEnabled)") Kendra Web Page Indexer
    v-card(id="alexa-modal")
      v-card-title(primary-title)
        .headline Kendra Web Page Indexer
      v-card-text
        p Current Status {{status}}
      v-card-actions
        v-btn(
          id="btnKendraStartIndex" 
          :disabled="status == 'PENDING' || status=='STARTING'"
          @click="start"
        ) Start Indexing

      
      v-flex(v-if="history && history.length>0")
        v-card
          table.table
            caption <h3>Sync History</h3>
            tr
              th(style="text-align:left") Start Time
              th(style="text-align:left") End Time
              th(style="text-align:left") Status
              th(style="text-align:left") Error Message
              th(style="text-align:left") Documents Added
              th(style="text-align:left") Documents Modified
              th(style="text-align:left") Documents Failed


            template(v-for="(job,index) in history")
                tr
                  td {{job.StartTime}}
                  td {{job.EndTime}}
                  td {{job.Status}}
                  td {{job.ErrorMessage}}
                  td {{job.Metrics.DocumentsAdded}}
                  td {{job.Metrics.DocumentsModified}}
                  td {{job.Metrics.DocumentsDeleted}}

      v-card-actions
        v-spacer
        v-btn(@click='dialog = false') Close
</template>

<script>
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

var Vuex=require('vuex')
var Promise=require('bluebird')
var _=require('lodash')
var Promise=require('bluebird')

module.exports={
  data:function(){
    var self=this
    return {
      status: "",
      history: {},
      dialog: false,
      text:false,
      ready:false,
      kendraIndexerEnabled:false,
      lastStatusCheck: Date.now()

    }
  },
  components:{
  },
  computed:{
    
  },
  updated:function(){
    console.log("created");
    var self = this;;
    this.poll( () => {
      console.log("polling")
      console.log("last status check " + Date.now())
      if(!this.lastStatusCheck || Date.now() - this.lastStatusCheck > 9000){
        self.getKendraIndexingStatus().then((data) => {
          self.status = data.Status;
          self.history = data.History,
          console.log("History " + JSON.stringify(self.history))
          self.lastStatusCheck = Date.now();

        })

       }
      //if the Kendra Start Index isn't displayed -- stop syncing
      return document.getElementById('btnKendraStartIndex').offsetWidth == 0;
    },600000,10000 ).catch((error) => console.log("Error trying to retrieve status " + error));
  },    
  mounted:function(){
      const self=this
      setTimeout(async function() {
        const settings=await self.$store.dispatch('api/listSettings');
        self.kendraIndexerEnabled = _.get(settings[2],"ENABLE_KENDRA_WEB_INDEXER")=="true" && _.get(settings[2],"KENDRA_INDEXER_URLS") !== "" 
        && _.get(settings[2],"KENDRA_WEB_PAGE_INDEX") !== "";
      }, 2000);
    },
  methods:{
    start:async function(){

      this.$store.dispatch('api/startKendraIndexing').catch((err) => console.log(`error while trying to start indexing ` + err ))
      this.status = "STARTING"
      await new Promise(r => setTimeout(r, 3000));
      this.getKendraIndexingStatus().then((data) => {
          this.status = data.Status;
        })
      this.$forceUpdate();
    },

    getKendraIndexingStatus: async function(){
      var result = await this.$store.dispatch("api/getKendraIndexingStatus")
      return result;},

    poll: function(fn, timeout, interval) {
    var endTime = Number(new Date()) + (timeout || 2000);
    interval = interval || 100;

    var checkCondition = function(resolve, reject) {
        // If the condition is met, we're done! 
        var result = fn();
        if(result) {
            resolve(result);
        }
        // If the condition isn't met but the timeout hasn't elapsed, go again
        else if (true) /*Number(new Date()) < endTime) */{
            setTimeout(checkCondition, interval, resolve, reject);
        }
        // Didn't match and too much time, reject!
        else {
            reject(new Error('timed out for ' + fn + ': ' + arguments));
        }
    };

    return new Promise(checkCondition);
}

  
  },
  
}
</script>

<style lang='scss' scoped>
</style>

