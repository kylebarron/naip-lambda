[![Build Status](https://travis-ci.org/kylebarron/serverless-aerial-imagery.svg?branch=master)](https://travis-ci.org/kylebarron/serverless-aerial-imagery)

## Install

```
git clone --recurse-submodules https://github.com/kylebarron/naip-lambda
cd naip-lambda
conda env create -f environment.yml
source activate naip-lambda
```

### Select TIF URLs

Download `manifest.txt`. This file has a listing of all files stored on the
`naip-visualization` bucket.

```bash
aws s3 cp s3://naip-visualization/manifest_2017.txt ./ --request-payer
```

**Note** in March 2020, 2018 data was added to the bucket, but as of March 15,
2020, `manifest.txt` hasn't been updated yet. [This graphic][naip_coverage_2018]
shows which states were photographed in 2018, so I'll list those files manually.

[naip_coverage_2018]: https://www.fsa.usda.gov/Assets/USDA-FSA-Public/usdafiles/APFO/status-maps/pdfs/NAIP_Coverage_2018.pdf

```bash
states="ca ut nm tx nd sd ne mo wi mi in ky tn ms wv nc va md de ct ri ma vt nh me"
for state in $(echo $states); do
  aws s3 ls --recursive "s3://naip-visualization/$state/2018/" --request-payer \
    | awk '{print $4}' \
    >> manifest_2018.txt
done

# Combine files
cat manifest_2017.txt manifest_2018.txt > manifest.txt
```

All (lower 48) states were photographed between 2011-2013, and again in
2014-2015. All states except Maine were photographed in 2016-2017. All states
except Oregon were photographed in 2017-2018.

I'll generate four MosaicJSONs: 2011-2013, 2014-2015, 2015-2017, 2016-2018. For
the last two, I include an extra start year just for Maine/Oregon, but set each
to use the latest available imagery, so only Maine takes imagery from 2015 and
only Oregon takes imagery from 2016, respectively. ([Here's an interactive
map][naip-years] of when each state was photographed, though it doesn't appear
to include 2018 yet.)

[naip-years]: https://www.arcgis.com/home/webmap/viewer.html?webmap=17944d45bbef42afb05a5652d7c28aa5

```bash
python code/naip.py manifest \
    -s 2011 \
    -e 2013 \
    --select-method last \
    manifest.txt \
    | sed -e 's|^|s3://naip-visualization/|' \
    > urls_2011_2013.txt
python code/naip.py manifest \
    -s 2014 \
    -e 2015 \
    --select-method last \
    manifest.txt \
    | sed -e 's|^|s3://naip-visualization/|' \
    > urls_2014_2015.txt
python code/naip.py manifest \
    -s 2015 \
    -e 2017 \
    --select-method last \
    manifest.txt \
    | sed -e 's|^|s3://naip-visualization/|' \
    > urls_2015_2017.txt
python code/naip.py manifest \
    -s 2016 \
    -e 2018 \
    --select-method last \
    manifest.txt \
    | sed -e 's|^|s3://naip-visualization/|' \
    > urls_2016_2018.txt
```

As an example, you can get the mosaic footprint of Rhode Island
```bash
cat urls_2011_2013.txt \
    | grep "^s3://naip-visualization/ri/" \
    | cogeo-mosaic footprint - > footprint.geojson
```

And inspect it with [kepler.gl](https://github.com/kylebarron/keplergl_cli):
```bash
kepler footprint.geojson
```

![](assets/rhode_island_footprint.png)

Here you can see that the tiles to be used in the mosaic of Rhode Island don't
include the state's border. That's because the Python script to parse the
manifest deduplicates tiles on the border when they're include in both states.
If you looked at the footprint of Connecticut, you'd see the missing tiles on
the border.

Total number of files
```bash
> wc -l urls_2011_2013.txt
  213197 urls_2011_2013.txt
```

### Create MosaicJSON

NAIP imagery tiffs are in a requester pays bucket. In order to access them, you
need to set the `AWS_REQUEST_PAYER` environment variable:

```bash
export AWS_REQUEST_PAYER="requester"
```

I also found that on an AWS EC2 instance; `cogeo-mosaic create` was failing
while it was working on my local computer. In general, if `cogeo-mosaic create`
isn't working for some URL; you should run `rio info <URL>` and see what the
error is, since `cogeo-mosaic` uses `rasterio` internally, but doesn't currently
print `rasterio` errors to stdout. In my case, I had to set the certificates
path (see
[cogeotiff/rio-tiler#19](https://github.com/cogeotiff/rio-tiler/issues/19),
[mapbox/rasterio#942](https://github.com/mapbox/rasterio/issues/942)).

```bash
export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
```

I don't know how much data `cogeo-mosaic create` downloads (it only requests the
GeoTIFF headers of each file), but it might be wise to run the mosaic creation
on an AWS EC2 instance in the `us-west-2` region (the same region where the NAIP
imagery is located), so that you don't have to pay for egress bandwidth on the
requests. I found that creating the mosaic took about 1.5GB of memory; it
finished in about 7 hours per mosaic on a `t2.small` instance.

Then create the MosaicJSON file. GET requests are priced at `$0.0004` per 1000
requests, so creating the MosaicJSON should cost `0.0004 * (200000 / 1000) =
0.08`. 8 cents!

```bash
cat urls_2011_2013.txt \
    | cogeo-mosaic create - \
    > naip_2011_2013_mosaic.json
cat urls_2014_2015.txt \
    | cogeo-mosaic create - \
    > naip_2014_2015_mosaic.json
cat urls_2015_2017.txt \
    | cogeo-mosaic create - \
    > naip_2015_2017_mosaic.json
cat urls_2016_2018.txt \
    | cogeo-mosaic create - \
    > naip_2016_2018_mosaic.json
```

### Deploy

```bash
# Create lambda package
cd cogeo-mosaic-tiler
make package
cd ..

# Deploy
npm install serverless -g
sls deploy --bucket bucket-name
```

Add the mosaic json

```bash
export ENDPOINT_URL="..."
curl -X POST -d @naip_2011_2013_mosaic.json "${ENDPOINT_URL}/add"
curl -X POST -d @naip_2014_2015_mosaic.json "${ENDPOINT_URL}/add"
curl -X POST -d @naip_2015_2017_mosaic.json "${ENDPOINT_URL}/add"
```

### Custom endpoint

```
https://us-west-2.console.aws.amazon.com/acm/home?region=us-west-2#/firstrun/
```

Go to Cloudflare > Choose Domain > SSL/TLS > Origin Server > Create Certificate.

https://support.cloudflare.com/hc/en-us/articles/115000479507#h_30cc332c-8f6e-42d8-9c59-6c1f06650639
