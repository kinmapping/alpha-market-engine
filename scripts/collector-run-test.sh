#!/bin/bash

docker-compose -f docker-compose.local.yml exec collector npm run test:unit
docker-compose -f docker-compose.local.yml exec collector npm run test:integration