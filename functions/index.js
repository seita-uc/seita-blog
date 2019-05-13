'use strict';

const cheerio = require('cheerio');
const request = require('request');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = functions.config().service_account;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

function parseOgp(url) {
    return new Promise((resolve, reject) => {
        request({
            method: 'GET',
            url: encodeURI(url)
        }, (err, res, body) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            const $ = cheerio.load(res.body);
            let ogp = new Object();
            ogp['siteName'] = $('title').text();
            $('head').contents().filter('meta').each((i, elem) => {
                if (elem.hasOwnProperty('attribs')) {
                    const attrs = elem.attribs;
                    if (Object.prototype.hasOwnProperty.call(attrs, 'property')) {
                        if (/^og:/g.test(attrs.property)) {
                            let prop = attrs.property;
                            let content = attrs.content;
                            ogp[prop.split(':')[1]] = content.replace(/\r?\n/g,"");
                        }
                    }
                }
            });
            resolve(ogp);
        });
    });
}

exports.ogp = functions.https.onRequest((req, res) => {
    const params = req.query;
    const chacheControl = 'public, max-age=31557600, s-maxage=31557600';
    if (!params.hasOwnProperty('url')) {
        console.error("Error getting ogp data: please provide url");
        return res.json({ error: "Error getting ogp data: please provide url" });
    }

    return parseOgp(params['url'])
        .then((ogp) => {
            console.log("Successfully scraped ogp data: " + ogp);
            return res.set('Cache-Control', chacheControl).json(ogp);
        })
        .catch((err) => {
            console.error("Error getting ogp data: " + err);
            return res.json({ error: err });
        });
});

