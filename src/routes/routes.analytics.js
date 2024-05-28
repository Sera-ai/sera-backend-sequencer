const express = require("express");
const router = express.Router();
const tx_Log = require("../models/models.tx_logs");

const { learnOas } = require("../helpers/helpers.learning");
const { fetchDNSHostAndEndpointDetails } = require("../helpers/helpers.database");

const sera_dns = require("../models/models.dns")
const sera_host = require("../models/models.hosts")
const sera_oas = require("../models/models.oas")

router.post("/new", async (req, res) => {
    console.log(req.body)
    if (true) {
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

    console.log(seraHost)

    learnOas({ seraHost, urlData, response: req.body.response, req: req.body.request });

});

module.exports = router;


function cleanUrl(url) {
    // This regex matches "http://", "https://", and "www." at the beginning of the string
    const pattern = /^(https?:\/\/)?(www\.)?/;
    return url.replace(pattern, "");
}