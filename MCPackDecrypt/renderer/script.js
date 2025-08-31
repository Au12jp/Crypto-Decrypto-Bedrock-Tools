electron.getPacks().then(ready)


const worker = new Worker('worker.js')

const queue = [];

function addToQueue(element, postFunc) {
    queue.push({
        element: element,
        postFunc: postFunc
    })
    if (queue.length === 1) {
        nextQueue();
    }
}

function endQueue() {
    queue.shift();
}

function nextQueue() {
    const item = queue[0]
    if (!item) return;

    item.element.id = "pack-running";
    item.postFunc();
    
}

worker.onmessage = (e) => {
    if (e.data === "end") {
        document.querySelector('#pack-running #pack-progress').style.width = "0%";
        document.querySelector('#pack-running').id = "pack";
        endQueue();
        nextQueue();
        if (queue.length === 0) {
            alert("The pack(s) was decrypted.")
        }
        return;
    }
    document.querySelector('#pack-running #pack-progress').style.width = e.data + "%"
}


const categoriesEl = document.getElementById("categories");

function ready(categories) {
    const order = ["worlds", "world_templates", "resource_packs", "skin_packs", "persona"];
    const keys = Object.keys(categories).sort((a, b) => {
        return order.indexOf(a) - order.indexOf(b)
    });
	if(keys.length > 0) {
		for (let i = 0; i < keys.length; i++) {
			const name = keys[i];
			const categoryEl = createCategoryEl(name, categories[name])
			categoriesEl.appendChild(categoryEl);
		}
	}
	else {
		displayError("No encrypted pack(s) were found.");
	}
}


function displayError(msg) {
	const errorEl = document.createElement("div");
	errorEl.classList.add("error-msg")
	const errorP = document.createElement("p");
	errorP.textContent = msg;
	errorEl.appendChild(errorP);
	categoriesEl.appendChild(errorEl);
}

function createCategoryEl(name, packs) {
    const categoryEl = document.createElement("div");
    categoryEl.classList.add("category");
    
    categoryEl.innerHTML = `<div class="category-title">${name.replace("_", " ")}</div>`

    const packsEl = document.createElement("div");
    packsEl.classList.add("packs");

    for (let i = 0; i < packs.length; i++) {
        const pack = packs[i];
        const packEl = createPackEl(pack, name);
        packsEl.appendChild(packEl);
    }
    categoryEl.appendChild(packsEl);
    return categoryEl;
}

function createPackEl(pack, type) {
    const packEl = document.createElement("div");
    packEl.classList.add("pack");

    const packClick = async() => {
        const outPath = await electron.pickPath({path: pack.packPath, type, name: pack.name});
        if (!outPath) return;
        
		if(packEl.id === "pack-queued") return;
		if(packEl.id === "pack-running") return;
		
        packEl.id = "pack-queued"
        addToQueue(packEl, () => worker.postMessage({outPath, path: pack.packPath, type, name: pack.name}))
        
    }

    packEl.addEventListener("click", packClick)

    packEl.innerHTML = `  
        <div id="pack-progress"></div>
        <img class="pack-icon ${!pack.packIcon ? 'pack-unknown-icon' : ''}" src="${pack.packIcon ? `data:image/png;base64,${pack.packIcon}` : './pack.png'}" class="pack-icon"></img>
        <div class="pack-name">${pack.name}</div>
    `
    return packEl;
}