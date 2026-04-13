#!/bin/sh
set -e

if [ -f .env ]; then
  echo ".env already exists, skipping."
else
  cp .env.example .env
  echo "Created .env from .env.example — fill in your values."
fi

for dir in cms web; do
  if [ -L "$dir/.env" ]; then
    echo "$dir/.env symlink already exists, skipping."
  else
    ln -s ../.env "$dir/.env"
    echo "Linked $dir/.env → ../.env"
  fi
done
