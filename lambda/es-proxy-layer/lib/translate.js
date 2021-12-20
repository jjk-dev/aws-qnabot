const _ = require('lodash');
const AWS = require('aws-sdk');
const qnabot = require("qnabot/logging")


async function get_terminologies(sourceLang) {
    const translate = new AWS.Translate();
    qnabot.log("Getting registered custom terminologies");
    const configuredTerminologies = await translate.listTerminologies({}).promise();
    qnabot.log("terminology response " + JSON.stringify(configuredTerminologies));
    const sources = configuredTerminologies["TerminologyPropertiesList"].filter(t => t["SourceLanguageCode"] == sourceLang).map(s => s.Name);
    qnabot.log("Filtered Sources " + JSON.stringify(sources));
    return sources;
}

async function get_translation(englishText, targetLang, req) {
    qnabot.log("get_translation:", targetLang, "InputText: ", englishText);
    if (targetLang === 'en') {
        qnabot.log("get_translation: target is en, translation not required. Return english text");
        return englishText;
    }

    const translateClient = new AWS.Translate();
    try {
        var customTerminologyEnabled = _.get(req._settings, "ENABLE_CUSTOM_TERMINOLOGY") == true;
        qnabot.log("get translation request " + JSON.stringify(req))

        const params = {
            SourceLanguageCode: 'en', /* required */
            TargetLanguageCode: targetLang, /* required */
            Text: englishText, /* required */
        };
        if (customTerminologyEnabled) {
            var customTerminologies = await get_terminologies("en")
            params["TerminologyNames"] = customTerminologies;
        }

        qnabot.log("input text:", englishText);
        const translation = await translateClient.translateText(params).promise();
        qnabot.log("translation:", translation);
        const regex = /\s\*\s+$/m;
        translation.TranslatedText = translation.TranslatedText.replace(regex, '*\n\n') // Translate adds a space between the "*" causing incorrect Markdown
        translation.TranslatedText = translation.TranslatedText.replace(/<\/?span[^>]*>/g,""); // removes span tag used to keep Translate from translating URLs
        return translation.TranslatedText;
    } catch (err) {
        qnabot.log("warning - error during translation: ", err);
        return englishText;
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

exports.translate_hit = async function(hit,usrLang,req){
    qnabot.log("translate_hit:", JSON.stringify(hit,null,2));
    let hit_out = _.cloneDeep(hit);
    let a = _.get(hit, "a");
    let markdown = _.get(hit, "alt.markdown");
    let ssml = _.get(hit, "alt.ssml");
    let rp = _.get(hit, "rp");
    let r = _.get(hit, "r");

    // catch and log errors before throwing exception.
    if (a && _.get(hit,'autotranslate.a')) {
        try {
            hit_out.a = await get_translation(hit_out.a, usrLang,req);
        } catch (e) {
            qnabot.log("ERROR: Answer caused Translate exception: ", a)
            throw (e);
        }
    }
    if (markdown && _.get(hit,'autotranslate.alt.markdown')) {
        try {
            const res = await get_translation(hit_out.alt.markdown, usrLang,req);
            hit_out.alt.markdown  = replaceAll(res,'] (http', '](http');
        } catch (e) {
            qnabot.log("ERROR: Markdown caused Translate exception: ", a)
            throw (e);
        }
    }
    if (ssml && _.get(hit,'autotranslate.alt.ssml')) {
        try {
            hit_out.alt.ssml = await get_translation(hit_out.alt.ssml, usrLang,req);
        } catch (e) {
            qnabot.log("ERROR: SSML caused Translate exception: ", a);
            throw (e);
        }
    }
    if (rp && _.get(hit,'autotranslate.rp')) {
        try {
            hit_out.rp = await get_translation(hit_out.rp, usrLang, req);
        } catch (e) {
            qnabot.log("ERROR: Reprompt caused Translate exception: ", rp);
            throw (e);
        }
    }
    if (r) {
        try {
            if (r.subTitle && r.subTitle.length > 0  && _.get(hit,'autotranslate.r.subTitle')) {
                hit_out.r.subTitle = await get_translation(hit_out.r.subTitle, usrLang,req) ;
            }
            if (r.title && r.title.length > 0 && _.get(hit,'autotranslate.r.title')) {
                hit_out.r.title = await get_translation(hit_out.r.title, usrLang,req) ;
            }
            if (r.text && r.text.length > 0) {
                // no op
            }
            if (r.imageUrl && r.imageUrl.length > 0) {
                // no op
            }
            if (r.url && r.url.length > 0) {
                // no op
            }
            if (r.buttons && r.buttons.length > 0) {
                for (let x=0; x<r.buttons.length; x++) {
                    if (_.get(hit,'autotranslate.r.buttons[x].text')) {
                        hit_out.r.buttons[x].text = await get_translation(hit_out.r.buttons[x].text, usrLang,req) ;
                    }
                    if (_.get(hit,'autotranslate.r.buttons[x].value')) {
                        if (! hit_out.r.buttons[x].value.toLowerCase().startsWith("qid::")) {
                            hit_out.r.buttons[x].value = await get_translation(hit_out.r.buttons[x].value, usrLang, req);
                        }
                    }                    
                }
            }
        } catch (e) {
            qnabot.log("ERROR: response card fields format caused Translate exception. Check syntax: " + e );
            throw (e);
        }

    }
    // session attributes
    if (_.get(hit, "sa")){
        hit_out.sa=[];
        const promises = hit.sa.map(async obj=>{
            if (obj.enableTranslate) {
                try {
                    hit_out.sa.push({text:obj.text, value: await get_translation(obj.value, usrLang, req), enableTranslate: obj.enableTranslate});
                } catch (e) {
                    qnabot.log("ERROR: Session Attributes caused Translation exception. Check syntax: ", obj.text);
                    throw (e);
                }
            }
        });
        await Promise.all(promises);
    }
    qnabot.log("Preprocessed Result: ", hit_out);
    return hit_out;    
};
