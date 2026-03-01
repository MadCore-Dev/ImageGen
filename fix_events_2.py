with open("events_to_add.js", "r") as f:
    js = f.read()

js = js.replace("this.value", "e.currentTarget.value")
js = js.replace("handleCustomUpload(event)", "handleCustomUpload(e)")
js = js.replace("importSessionJSON(event)", "importSessionJSON(e)")

with open("events_to_add.js", "w") as f:
    f.write(js)
