#!/bin/bash

cd services/collector || exit 1
rm -rf node_modules package-lock.json && npm install