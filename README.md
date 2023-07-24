## Intsallation

1. `git clone https://github.com/shreyash-x/WMStatus.git`
2. `cd WMStatus` and `npm i`
3. Set up the config file in config directory, main is for the main server and backup is for the second server. The main.yaml is run by default. To use backup.yaml modify run.sh to run `npm run backup`.
    ```yaml
    mailer:
    enabled: true
    email: yourmail

    services:
    frontend:
        name: <service name as per pm2>
    backend:
        name: <service name as per pm2>
    mongodb:
        uri: <mongodb uri where whatsapp logs are stored>
    ```
4. Modify the run.sh as per your needs. Add the run.sh into your cronjob to run it regularly `0 12 * * * /home/kg766/whatsappMonitor/downloadTool/run.sh`
5. Set up netlify service to deploy the WM status website 
    ```sh
        npm install netlify-cli
        npx netlify login # complete netlify auth here
        npx netlify sites:create --name <your webapp name> # note down the website url
    ```
 