#!/bin/bash

# docker-compose -f docker-compose.local.yml up --build collector redis
docker-compose -f docker-compose.local.yml up --build collector redis prometheus grafana
