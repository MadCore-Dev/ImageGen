import re

html_file = 'index.html'
js_file = 'js/app.js'

with open(html_file, 'r', encoding='utf-8') as f:
    html_content = f.read()

# We need to find elements with onclick, oninput, onchange
# and ensure they have an id. If they don't, we add one.
# We also need to build the JS to attach event listeners.

js_additions = []
id_counter = 1

def replace_handler(match):
    global id_counter
    tag = match.group(0)
    
    # Check if there's an id
    id_match = re.search(r'id="([^"]+)"', tag)
    if id_match:
        el_id = id_match.group(1)
    else:
        # Check if it has a specific class like style-chip, preset-btn, etc. that we can query.
        # Actually, for buttons without IDs that pass 'this', it's better to add an ID.
        el_id = f"autoGenId_{id_counter}"
        id_counter += 1
        # Insert ID after the tag name
        tag = re.sub(r'^<([a-zA-Z0-9]+)', r'<\1 id="' + el_id + '"', tag)

    # Extract handlers
    for attr in ['onclick', 'oninput', 'onchange']:
        attr_match = re.search(fr'{attr}="([^"]+)"', tag)
        if attr_match:
            code = attr_match.group(1)
            # Remove the inline handler from the HTML
            tag = re.sub(fr'\s{attr}="[^"]+"', '', tag)
            
            # If code is like `selectStyle(this)`, we need to map `this` to the event target
            if 'this' in code:
                # E.g., selectStyle(this) -> selectStyle(e.currentTarget)
                code = code.replace('(this', '(e.currentTarget')
                code = code.replace(', this)', ', e.currentTarget)')
            
            if attr == 'onclick':
                event = 'click'
            elif attr == 'oninput':
                event = 'input'
            elif attr == 'onchange':
                event = 'change'

            # Replace event.stopPropagation() -> e.stopPropagation()
            if 'event.' in code:
                code = code.replace('event.', 'e.')

            js_additions.append(f"    const el_{el_id} = document.getElementById('{el_id}');\n    if (el_{el_id}) el_{el_id}.addEventListener('{event}', (e) => {{ {code} }});")

    return tag

# Regex to match any tag with an inline event handler
# <name ... onclick="..." ...>
new_html = re.sub(r'<[^>]+\s(on(?:click|input|change))="[^"]+"[^>]*>', replace_handler, html_content)


js_block = """
export function initEventListeners() {
""" + "\n".join(js_additions) + """
}
"""

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(new_html)

with open('events_to_add.js', 'w', encoding='utf-8') as f:
    f.write(js_block)

print("Done parsing HTML. Script written to events_to_add.js")
