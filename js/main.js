/* =====================================================
   THEKUA STORE — JAVASCRIPT   (file map)
   1. CONFIG & PRODUCTS  <- the ONLY part most people need to edit
   2. Helpers            ($, money, el, thekuaSVG, toast)
   3. Cart               (add / remove / totals / save to browser)
   4. WhatsApp           (builds the order message and opens wa.me)
   5. Cart drawer        (open / close)
   6. Rendering          (products, static text)
   7. Checkout validation
   8. init()             (wires everything together at page load)
   ===================================================== */
/* ===== CONFIG: edit this block =====
   Everything below is a PLACEHOLDER until the business confirms it.
   Prices are in paise (₹1 = 100 paise) to avoid floating-point errors. */
const CONFIG = {
  brand: "Beehari Bites",  // brand name, used in the page title and footer
  announcement: "Authentic Bihar Ka Swaad, delivered with love.",
  whatsapp: "",            // e.g. "919876543210" (country code + number, digits only). Empty = WhatsApp disabled.
  email: "beeharibites@gmail.com", phone: "+91 8240314745",  // contact info for the footer
  shippingPaise: null,     // null = "Confirmed on WhatsApp". Set a number to charge a flat fee.
  trust: ["Inspired by Bihar’s traditions", "Packed with care", "A treat meant for sharing"],
  why: [["Tradition at the Heart","Rooted in the festive food culture of Bihar."],["Thoughtfully Made","Crafted with care, inspired by Bihar's timeless traditions."],["Packed with Care","Carefully packed to bring a little taste of Bihar to your home."],["A Taste Worth Sharing","Made for family, festivals and gifting."]],
  reviews: [],             // add only real, approved reviews: {name, text}
  faqs: [["What is Thekua?","A traditional Bihari sweet snack associated with festivals and family traditions, including Chhath Puja."],["What varieties and pack sizes are available?","See the Shop section. [Sample data — update with your real range.]"],["What ingredients are used?","[To be confirmed by the business.]"],["How should I store Thekua?","[To be confirmed by the business.]"],["What is the shelf life?","[To be confirmed by the business.]"],["Where do you deliver?","[To be confirmed by the business.]"],["How can I place an order?","Add items to the cart and order on WhatsApp. We will confirm availability, delivery charges and payment with you."],["Can I place bulk or gifting orders?","Yes — enquire on WhatsApp. [Confirm with the business.]"],["What payment methods are supported?","[To be confirmed. Online payment is not yet configured.]"],["How can I contact support?","Use the Contact section or WhatsApp."]]
};
/* PRODUCT FIELDS:
   id       unique, no spaces (used internally)
   name     title on the card         desc  one-line description
   badge    optional label such as "Bestseller" (delete the key for none)
   inStock  true / false              tone  colour of the illustration (hex)
   variants pack sizes: {id, label, price}. price is in PAISE: ₹150 = 15000.
   To add a product, copy one line and change the values. */
const PRODUCTS = [  // SAMPLE DATA — replace names, descriptions, prices and stock
  {id:"classic",name:"Classic Thekua",desc:"Traditional wheat-based Thekua. [Sample]",badge:"Bestseller",inStock:true,tone:"#b9772e",variants:[{id:"250",label:"250 g",price:15000},{id:"500",label:"500 g",price:28000}]},
  {id:"gur",name:"Gur Thekua",desc:"Jaggery-sweetened Thekua. [Sample]",inStock:true,tone:"#9a5a22",variants:[{id:"250",label:"250 g",price:17000},{id:"500",label:"500 g",price:32000}]},
  {id:"festive",name:"Festive Thekua",desc:"Special-occasion Thekua. [Sample]",inStock:false,tone:"#c28a3a",variants:[{id:"500",label:"500 g",price:35000}]},
  {id:"gift",name:"Thekua Gift Box",desc:"A boxed selection for gifting. [Sample]",badge:"Gift",inStock:true,tone:"#a8641f",variants:[{id:"box",label:"Gift box",price:60000}]}
];
/* ===== end CONFIG ===== */

/* ---------- HELPERS ---------- */
// $('#id') = shortcut for document.querySelector
const $ = (s, r=document) => r.querySelector(s);
// money(15000) -> '₹150'. Converts paise to a rupee string (Indian digit grouping).
const money = p => "₹" + (p/100).toLocaleString("en-IN",{minimumFractionDigits:p%100?2:0});
// el('div', {class:'x'}, 'text', childElement) builds DOM safely: text is never parsed as HTML,
// so product names/user input cannot inject code. Props starting with 'on' become event listeners.
function el(tag, props={}, ...kids){ // safe DOM builder: text never parsed as HTML
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){ if(k==="class")n.className=v; else if(k.startsWith("on"))n.addEventListener(k.slice(2),v); else n.setAttribute(k,v); }
  kids.flat().forEach(c=>n.append(c));
  return n;
}
// Draws the placeholder Thekua illustration. To use real photos, replace this with an <img> in renderProducts().
function thekuaSVG(tone="#b9772e"){
  const s=document.createElementNS("http://www.w3.org/2000/svg","svg");
  s.setAttribute("viewBox","0 0 200 150");s.setAttribute("width","100%");s.setAttribute("aria-hidden","true");
  s.innerHTML=[[60,60,-14],[130,52,10],[95,98,-4]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="42" ry="26" fill="${tone}"/><ellipse rx="42" ry="26" fill="none" stroke="#6b3b12" stroke-opacity=".45" stroke-width="2"/><path d="M-26 0Q0-14 26 0M-26 8Q0-6 26 8M-22-9Q0-20 22-9" stroke="#6b3b12" stroke-opacity=".5" stroke-width="2" fill="none"/></g>`).join("");
  return s;
}
// Shows a short message at the bottom of the screen for ~1.8 seconds.
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),1800);}

/* CART NOTES: items are stored as {id, v (variant id), qty}. Max 20 per line (change the number 20 below).
   Only these small fields go to localStorage - never personal or payment data.
   Totals are always recalculated from PRODUCTS, so edited prices apply automatically. */
/* ---------- Cart ---------- */
const CART_KEY="thekua_cart_v1";
const cart={items:[],
  load(){try{const raw=JSON.parse(localStorage.getItem(CART_KEY)||"[]");
    // Validate stored data: drop unknown products/variants, clamp quantities
    this.items=(Array.isArray(raw)?raw:[]).map(i=>({id:String(i&&i.id),v:String(i&&i.v),qty:Math.min(20,Math.floor(Number(i&&i.qty)))})).filter(i=>i.qty>=1&&this.lookup(i)&&this.lookup(i).p.inStock);
  }catch{this.items=[];}},
  save(){try{localStorage.setItem(CART_KEY,JSON.stringify(this.items))}catch{}},
  lookup(i){const p=PRODUCTS.find(p=>p.id===i.id);const v=p&&p.variants.find(v=>v.id===i.v);return v?{p,v}:null;},
  add(id,v){const p=PRODUCTS.find(p=>p.id===id);if(!p||!p.inStock)return;
    const ex=this.items.find(i=>i.id===id&&i.v===v);if(ex)ex.qty=Math.min(20,ex.qty+1);else this.items.push({id,v,qty:1});
    this.save();this.render();toast(p.name+" added to cart");},
  setQty(idx,q){if(q<1)return this.remove(idx);this.items[idx].qty=Math.min(20,q);this.save();this.render();},
  remove(idx){this.items.splice(idx,1);this.save();this.render();toast("Item removed");},
  subtotal(){return this.items.reduce((s,i)=>{const l=this.lookup(i);return s+l.v.price*i.qty},0);},
  shipping(){return CONFIG.shippingPaise==null?null:(this.items.length?CONFIG.shippingPaise:0);},
  total(){return this.subtotal()+(this.shipping()||0);},
  count(){return this.items.reduce((s,i)=>s+i.qty,0);},
  render(){
    const c=this.count();$("#count").textContent=c;$("#cartBtn").setAttribute("aria-label",`Open cart, ${c} item${c===1?"":"s"}`);
    const ul=$("#lines");ul.replaceChildren();
    this.items.forEach((i,idx)=>{const {p,v}=this.lookup(i);
      ul.append(el("li",{},
        el("div",{},el("strong",{},p.name),el("div",{class:"sample"},v.label+" · "+money(v.price))),
        el("strong",{},money(v.price*i.qty)),
        el("div",{class:"qty",role:"group","aria-label":"Quantity for "+p.name},
          el("button",{type:"button","aria-label":"Decrease quantity of "+p.name,onclick:()=>this.setQty(idx,i.qty-1)},"−"),
          el("span",{"aria-live":"polite"},String(i.qty)),
          el("button",{type:"button","aria-label":"Increase quantity of "+p.name,onclick:()=>this.setQty(idx,i.qty+1)},"+")),
        el("button",{class:"link",type:"button",onclick:()=>this.remove(idx)},"Remove")));});
    const has=c>0;$("#empty").hidden=has;ul.hidden=!has;
    $("#sub").textContent=money(this.subtotal());
    $("#ship").textContent=this.shipping()==null?"Confirmed on WhatsApp":money(this.shipping());
    $("#total").textContent=money(this.total())+(this.shipping()==null?" + shipping":"");
    $("#checkoutBtn").disabled=!has;
    const waOk=has&&waReady();$("#waBtn").disabled=!waOk;$("#waBtn").title=waReady()?"":"WhatsApp number not configured";
  }};

/* ---------- WhatsApp ---------- */
// True only if CONFIG.whatsapp looks like 10-15 digits. Otherwise WhatsApp buttons stay disabled.
const waReady=()=>/^\d{10,15}$/.test(CONFIG.whatsapp);
// Opens WhatsApp in a new tab with the message pre-filled (customer reviews it before sending).
function openWA(text){if(!waReady()){toast("WhatsApp number is not configured");return;}
  window.open("https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(text),"_blank","noopener");}
// Builds the order text. Pass a customer object only if they ticked the consent box.
// Edit the greeting / closing lines here to change the message wording.
function orderMessage(customer){
  const lines=cart.items.map((i,n)=>{const {p,v}=cart.lookup(i);return `${n+1}. ${p.name} — ${v.label} × ${i.qty}`});
  let m="Hello! I would like to place an order:\n\n"+lines.join("\n")+"\n\nEstimated subtotal: "+money(cart.subtotal());
  if(customer)m+="\n\nName: "+customer.name+"\nPhone: "+customer.phone+"\nAddress: "+customer.addr;
  return m+"\n\nPlease confirm availability, delivery charges, payment options, and delivery details.\n\nThank you!";
}

/* ---------- Drawer (focus management) ---------- */
/* ---------- DRAWER: remembers the last focused element so focus returns there on close (accessibility) ---------- */
let lastFocus=null;
function openDrawer(){lastFocus=document.activeElement;$("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");$("#overlay").classList.add("show");$("#closeCart").focus();}
function closeDrawer(){$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");$("#overlay").classList.remove("show");if(lastFocus)lastFocus.focus();}

/* ---------- Render page ---------- */
/* ---------- RENDER PAGE ---------- */
// Builds one card per item in PRODUCTS: image, name, size dropdown, live price, Add button.
function renderProducts(){
  const host=$("#products");
  PRODUCTS.forEach(p=>{
    const sel=el("select",{id:"v-"+p.id,"aria-label":"Pack size for "+p.name},p.variants.map(v=>el("option",{value:v.id},v.label)));
    const price=el("div",{class:"price"},money(p.variants[0].price));
    sel.addEventListener("change",()=>{price.textContent=money(p.variants.find(v=>v.id===sel.value).price)});
    const btn=el("button",{class:"btn",type:"button"},p.inStock?"Add to cart":"Out of stock");
    if(!p.inStock)btn.disabled=true;else btn.addEventListener("click",()=>cart.add(p.id,sel.value));
    const img=el("div",{class:"img",role:"img","aria-label":p.name+" — illustration"});img.append(thekuaSVG(p.tone));
    host.append(el("article",{class:"card"},p.badge?el("span",{class:"tag"},p.badge):"",img,
      el("div",{class:"body"},el("h3",{},p.name),el("p",{},p.desc),sel,price,btn)));
  });
}
// Fills text sections from CONFIG (brand, announcement, trust, why-us, FAQ, contact, reviews).
function renderStatic(){
  document.title=CONFIG.brand+" – Traditional Bihari Thekua";
  $("#announce").textContent=CONFIG.announcement;
  ["#brandName","#footBrand","#footBrand2"].forEach(s=>$(s).textContent=CONFIG.brand);
  $("#year").textContent=new Date().getFullYear();
  $("#trust").append(...CONFIG.trust.map(t=>el("li",{},el("span",{"aria-hidden":"true",style:"color:var(--gold)"},"✦"),t)));
  $("#feat").append(...CONFIG.why.map(([h,t])=>el("div",{},el("h3",{},h),el("p",{style:"color:var(--muted);margin:0"},t))));
  $("#faqList").append(...CONFIG.faqs.map(([q,a])=>el("details",{},el("summary",{},q),el("p",{},a))));
  $("#contactInfo").textContent="Email: "+CONFIG.email+" · Phone: "+CONFIG.phone+"";
  if(CONFIG.reviews.length){$("#reviews").hidden=false;$("#reviewList").append(...CONFIG.reviews.map(r=>el("blockquote",{class:"card",style:"margin:0;padding:1.2rem"},el("p",{},r.text),el("strong",{},r.name))));}
  $("#heroArt").append(thekuaSVG("#b9772e"));$("#storyArt").append(thekuaSVG("#a8641f"));
  document.querySelectorAll("[data-enquire]").forEach(b=>{b.addEventListener("click",()=>openWA("Hello! I would like to enquire about Thekua orders."));if(!waReady()){b.title="WhatsApp number not configured in CONFIG";b.setAttribute("aria-disabled","true");}});
}

/* ---------- Checkout validation ---------- */
/* ---------- CHECKOUT VALIDATION ----------
   Each rule is keyed by the input's id and returns true when valid, or an error message string. */
const rules={
  fName:v=>v.trim().length>=2||"Please enter your full name.",
  // Accepts 9876543210, 09876543210, 91 98765 43210, +91-9876543210
  fPhone:v=>/^(?:\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g,""))||"Enter a valid 10-digit Indian mobile number.",
  fEmail:v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||"Enter a valid email or leave blank.",
  fAddr:v=>v.trim().length>=8||"Please enter your full delivery address.",
  fCity:v=>v.trim().length>=2||"Please enter your city.",
  fState:v=>v.trim().length>=2||"Please enter your state.",
  fPin:v=>/^[1-9]\d{5}$/.test(v.trim())||"Enter a valid 6-digit PIN code."
};
// Runs rules, shows messages in the matching #e-<id> element, focuses the first invalid field.
function validate(map){let first=null;for(const [id,fn] of Object.entries(map)){const inp=$("#"+id),r=fn(inp.value),err=$("#e-"+id);
  err.textContent=r===true?"":r;inp.setAttribute("aria-invalid",r===true?"false":"true");if(r!==true&&!first)first=inp;}
  if(first)first.focus();return !first;}

// START-UP: runs once. Renders content, restores the saved cart, then attaches all click/keyboard handlers.
function init(){
  renderStatic();renderProducts();cart.load();cart.render();
  $("#cartBtn").addEventListener("click",openDrawer);$("#closeCart").addEventListener("click",closeDrawer);$("#overlay").addEventListener("click",closeDrawer);
  $("#emptyLink").addEventListener("click",closeDrawer);
  $("#menuBtn").addEventListener("click",e=>{const o=$("#nav").classList.toggle("open");e.currentTarget.setAttribute("aria-expanded",o);});
  $("#nav").addEventListener("click",e=>{if(e.target.closest("a")){$("#nav").classList.remove("open");$("#menuBtn").setAttribute("aria-expanded","false");}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#drawer").classList.contains("open")&&!$("#checkout").open)closeDrawer();
    // keep Tab inside the open drawer
    if(e.key==="Tab"&&$("#drawer").classList.contains("open")&&!$("#checkout").open){const f=[...$("#drawer").querySelectorAll("button:not(:disabled),a[href]")].filter(x=>x.offsetParent);if(!f.length)return;const a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}});
  $("#waBtn").addEventListener("click",()=>{if(cart.count())openWA(orderMessage());});
  $("#checkoutBtn").addEventListener("click",()=>{if(!cart.count())return;
    $("#coSummary").textContent=`Order summary: ${cart.count()} item(s) · Subtotal ${money(cart.subtotal())} · Shipping ${cart.shipping()==null?"confirmed on WhatsApp":money(cart.shipping())}`;$("#checkout").showModal();});
  $("#coClose").addEventListener("click",()=>$("#checkout").close());
  $("#coForm").addEventListener("submit",e=>{e.preventDefault();if(!validate(rules)||!cart.count())return;
    const customer=$("#fConsent").checked?{name:$("#fName").value.trim(),phone:$("#fPhone").value.trim(),addr:[$("#fAddr").value.trim(),$("#fCity").value.trim(),$("#fState").value.trim(),$("#fPin").value.trim()].join(", ")}:null;
    openWA(orderMessage(customer));});
  $("#contactForm").addEventListener("submit",e=>{e.preventDefault();
    if(!validate({cName:v=>v.trim().length>=2||"Please enter your name.",cMsg:v=>v.trim().length>=5||"Please enter a message."}))return;
    openWA(`Hello! I'm ${$("#cName").value.trim()}.\n\n${$("#cMsg").value.trim()}`);});
}
init();
