class Relay extends EventTarget{
    constructor(){
        super();
        this.onMessage = new Event('message');
        this.user = {};
        this.scriptUrl = new URL(import.meta.url);
        this.loginPromise = new Promise((resolve) => this.loginPromiseResolve = resolve);
        this.ready = new Promise(resolve => this.readyPromiseResolve = resolve)
        this.connect();
    }

    async connect(){
        this.socket = new WebSocket((this.scriptUrl.protocol.startsWith("https") ? "wss://" : "ws://") + this.scriptUrl.host);
        
        this.socket.addEventListener('open', (event) => {
            this.readyPromiseResolve(this)
            this.dispatchEvent(new CustomEvent('connected'))
        });

        // Listen for messages
        this.socket.addEventListener('message', (event) => {
            let msg = JSON.parse(event.data)
            switch(msg.type){
                case "status":
                    this.statusReceived(msg.content)
                    break;
                case "message":
                    this.dispatchEvent(new CustomEvent('message', { detail: msg.content }))
                    break;
                case "error":
                    this.dispatchEvent(new CustomEvent('error', { detail: msg.content }))
                    break;
                default:
                    console.log('Unknown message from server', event.data);
            }
            
        });
        
        this.socket.addEventListener('close', (event) => {
            console.log("Connection closed. Attempting reconnect...")
            this.dispatchEvent(new CustomEvent('disconnected'))
            this.connect()
        })
        
        this.socket.addEventListener('error', (...error) => {
            console.log.apply(null, error)
        })
    }

    async login(user){
        await this.ready;
        if(typeof user === "string")
            user = {id: user}
        if(!user.id)
            throw "ERROR: no user id provided for relay login"
        this.user = user;
        this.socket.send(JSON.stringify({type: "login", content: user}))
        return await this.loginPromise
    }

    async statusReceived({status, user}){
        switch(status){
            case "loggedin":
                Object.assign(this.user, user);
                this.dispatchEvent(new CustomEvent('loggedin', { detail: {user} }))
                this.loginPromiseResolve(this.user);
                break;
        }
    }

    async send({channel, content, participants = []} = {}){
        this.socket.send(JSON.stringify({type: "message", content: {channel, content: typeof content === "string" ? content : JSON.stringify(content), participants}}))
    }
    async getMessages(args){
        let query = `query getMessages($userId:String!, $key:String, $input:MessageSearchArgsType) {
                user(id:$userId, key: $key){
                id
                messages(input: $input) {
                    id
                    userId
                    channel
                    content
                    timestamp
                }
            }
        }`;

        let variables = {
            userId: this.user.id,
            key: this.user.key,
            input: args || {}
        }

        let messages = (await (await fetch(`${this.scriptUrl.origin}/graphql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables,
            })
          })).json()).data.user.messages

        return messages
    }
}

let relay = new Relay();
export default relay;