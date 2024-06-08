const express = require("express");
const router = express.Router();
const tx_Log = require("../models/models.tx_logs");

const { learnOas } = require("../helpers/helpers.learning");
const { fetchDNSHostAndEndpointDetails } = require("../helpers/helpers.database");

const sera_dns = require("../models/models.dns")
const sera_host = require("../models/models.hosts")
const sera_oas = require("../models/models.oas")
const sera_settings = require("../models/models.sera_settings")

// Function to obfuscate a string by replacing each character with a random character
const obfuscateString = (str) => {
    const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    return str.split('').map(char => {
        if (lowerChars.includes(char)) {
            return lowerChars[Math.floor(Math.random() * lowerChars.length)];
        } else if (upperChars.includes(char)) {
            return upperChars[Math.floor(Math.random() * upperChars.length)];
        } else if (numbers.includes(char)) {
            return numbers[Math.floor(Math.random() * numbers.length)];
        }
        return char; // Leave symbols, spaces, and other characters unchanged
    }).join('');
};

// Function to recursively obfuscate object values
const obfuscateObject = (obj) => {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obfuscateString(obj[key]);
        } else if (typeof obj[key] === 'object') {
            obfuscateObject(obj[key]);
        }
    }
};


router.post("/new", async (req, res) => {
    const settingsDoc = await sera_settings.findOne({ user: "admin" });
    const settings = settingsDoc ? settingsDoc.toObject() : {};
    console.log(settings)
    // Destructure the settings safely
    const {
        systemSettings: {
            seraSettings = {},
            proxySettings = {},
            dnsSettings = {}
        }
    } = settings;

    if (proxySettings.logAllRequests) {
        console.log("hmm")
        if (proxySettings.obfuscateLogData) {
            console.log("hmm2")

            // Obfuscate the request and response fields
            obfuscateObject(req.body.request);
            obfuscateObject(req.body.response);
        }

        // Log the obfuscated request data
        const data = new tx_Log(req.body);
        await data.save();
    }
    const { protocol = "https", hostname, path, method } = req.body;

    const clean_hostname = cleanUrl(hostname)
    const urlData = {
        protocol,
        hostname: clean_hostname,
        path,
        method,
        url: `${protocol}://${clean_hostname}${path}`,
    };

    const seraHostData = async () => {

        const { seraHost } =
            await fetchDNSHostAndEndpointDetails(urlData);

        if (!seraHost.result) {
            const dns = new sera_dns({
                "sera_config": {
                    "domain": clean_hostname.split(":")[0],
                    "expires": null,
                    "sub_domain": null,
                    "obfuscated": null
                },
            });

            const oas = new sera_oas({
                openapi: "3.0.1",
                info: {
                    title: "Minimal API",
                    version: "1.0.0",
                },
                servers: [{ url: clean_hostname.split(":")[0] }],
                paths: {},
            });
            const dns_res = (await dns.save()).toObject();
            const oas_res = (await oas.save()).toObject();

            const host = new sera_host({
                oas_spec: oas_res._id,
                sera_dns: dns_res._id,
                frwd_config: {
                    host: clean_hostname.split(":")[0],
                    port: clean_hostname.split(":")[1] || protocol == "https" ? 443 : 80,
                },
                sera_config: {
                    strict: false,
                    learn: true,
                    https: true,
                    drift: true,
                },
                hostname: clean_hostname.split(":")[0],
            });
            const host_res = (await host.save()).toObject()
            let modifyRes = { ...host_res }
            modifyRes.oas_spec = oas_res
            modifyRes.sera_dns = dns_res
            return modifyRes
            //build the whole damn thing!

        } else {
            return seraHost
        }
    }

    const seraHost = await seraHostData()

    const learnRes = await learnOas({ seraHost, urlData, response: req.body.response, req: req.body.request });
    res.send(learnRes)

});

module.exports = router;


function cleanUrl(url) {
    // This regex matches "http://", "https://", and "www." at the beginning of the string
    const pattern = /^(https?:\/\/)?(www\.)?/;
    return url.replace(pattern, "");
}