#!/bin/bash

npm run build
cd build
rsync -a --exclude node_modules . root@appgalleria.com:/var/www/google-docs-clone.appgalleria.com
cd ..

