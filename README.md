Client for [relay](https://github.com/palantus/relay).

Notice that a browser version of this client is exposed in [relay](https://github.com/palantus/relay) at https://<url>/client.mjs.

Use is it node like:
```js
import relay from "relay-client"

relay.connect("https://example.com")
relay.login({id: "username", key: "password"})
relay.addEventListener("loggedin", (data) => console.log("logged in", data))
```

Events:
- connected
- disconnected
- loggedin
- message
- error