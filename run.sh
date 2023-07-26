#!/bin/bash
<<<<<<< HEAD
# Get the current date and time in the desired format
current_date_time=$(date '+%Y-%m-%d %H:%M:%S')

# Print the line with the current date and time
echo "Running Whatsapp Explorer Downloader at $current_date_time"

export NVM_DIR=/home/kg766/.nvm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 16.16.0

=======
>>>>>>> a83396f2ef99ee4ed44e0069e086d36f8db69f09
cd /home/kg766/whatsappMonitor/downloadTool
npm run main
