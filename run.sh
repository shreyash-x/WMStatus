#!/bin/bash
script_dir=$(dirname "$0")
# Get the current date and time in the desired format
current_date_time=$(date '+%Y-%m-%d %H:%M:%S')

# Print the line with the current date and time
echo "Running Whatsapp Explorer Downloader at $current_date_time"

export NVM_DIR=$HOME/.nvm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 16.16.0

cd $script_dir
npm run main
