class Relay{
  constructor(fetcher, WebSocketClass){
    this.user = {};
    this.loginPromise = new Promise((resolve) => this.loginPromiseResolve = resolve);
    this.ready = new Promise(resolve => this.readyPromiseResolve = resolve);
    this.userDefined = new Promise(resolve => this.userDefinedPromiseResolve = resolve);
    this.listeners = {}
    this.fetcher = fetcher || fetch
    this.WebSocketClass = WebSocketClass || WebSocket
  }

  async addEventListener(type, listener){
    if(this.listeners[type])
      this.listeners[type].push(listener)
    else
      this.listeners[type] = [listener]
  }

  async dispatchEvent(type, data){
    if(!this.listeners[type])
      return;

      for(let listener of this.listeners[type]){
        listener(data)
      }
  }

  async connect(url){
    this.scriptUrl = new URL(url || this.scriptUrl || import.meta.url);
    this.socket = new this.WebSocketClass((this.scriptUrl.protocol.startsWith("https") ? "wss://" : "ws://") + this.scriptUrl.host);
    
    this.socket.addEventListener('open', (event) => {
      if(this.user.id){
        this.login(this.user)
      }

      this.readyPromiseResolve(this)
      this.dispatchEvent('connected')
    });

    // Listen for messages
    this.socket.addEventListener('message', (event) => {
      let msg = JSON.parse(event.data)
      switch(msg.type){
        case "status":
          this.statusReceived(msg.content)
          break;
        case "message":
          this.dispatchEvent('message', { detail: msg.content })
          break;
        case "error":
          this.dispatchEvent('error', { detail: msg.content })
          break;
        default:
          console.log('Unknown message from server', event.data);
      }
    });
    
    this.socket.addEventListener('close', async (event) => {
      this.ready = new Promise(resolve => this.readyPromiseResolve = resolve);
      this.loginPromise = new Promise((resolve) => this.loginPromiseResolve = resolve);
      console.log("Connection closed. Attempting reconnect...")
      this.dispatchEvent('disconnected')
      await this.connect()
    })
    
    this.socket.addEventListener('error', (...error) => {
      console.log.apply(null, error)
      console.log("Caught an error. Attempting reconnect...")
      this.dispatchEvent('disconnected')
      await this.connect()
    })

    return this.ready
  }

  async login(user){
    if(typeof user === "string")
        user = {id: user}
    if(!user.id)
        throw "ERROR: no user id provided for relay login"
    await this.ready;
    this.user = user;
    this.userDefinedPromiseResolve(this)
    this.socket.send(JSON.stringify({type: "login", content: user}))
    return await this.loginPromise
  }

  async statusReceived({status, user}){
    switch(status){
      case "loggedin":
        Object.assign(this.user, user);
        this.dispatchEvent('loggedin', { detail: {user} })
        this.loginPromiseResolve(this.user);
        break;
    }
  }

  async send({channel, content, participants = []} = {}){
    await this.loginPromise
    this.socket.send(JSON.stringify({type: "message", content: {channel, content: typeof content === "string" ? content : JSON.stringify(content), participants}}))
  }
  async getMessages(args){
    await this.userDefined
    let query = `query getMessages($userId:String!, $key:String, $input:MessageSearchArgsType) {
            user(id:$userId, key: $key){
            id
            messages(input: $input) {
                id
                userId
                channel
                content
                timestamp,
                isRead
            }
        }
    }`;

    let variables = {
      userId: this.user.id,
      key: this.user.key,
      input: args || {}
    }

    let res = (await (await this.fetcher(`${this.scriptUrl.origin}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        })
      })).json()).data;

    let messages = res.user.messages

    return messages
  }
}

export default Relay;