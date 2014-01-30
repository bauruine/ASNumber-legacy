/** Global variables **/

const ASN_CRLF = '\r\n';
const ASN_CR = '\r';
const ASN_LF = '\n';

var ASNLineEndings = ASN_CRLF;

var ASNAsync = false;
var ASNEnabled = true;

var ASNASServer = null;
var ASNAsyncCurrentHost = null;
var ASNCurrentASNumber = null;

var ASNIPCache = new Array();
var ASNASCache = new Array();

var ASNDNSResolver = null;
var ASNDNSRequest = null;

var ASNCacheCleanupInterval = null;

var ASNCheckIPv4 = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/

var ASNOpenTabs = true;
var ASNOpenForeground = false;
var ASNFastAccess = false;

var ASNTab = null;


/** Listener **/

var ASNProgressListener = {
	/* If something changes in the location bar */
	onLocationChange: function(webProgress, request, location) {
		ASNUnsetCurrentASNumber();
		
		ASNDisplay("AS ready", "AS Number ready", "text");

		if (!ASNEnabled)
			return;

		if (!location)
			return;

		if (location.scheme == 'file' || location.scheme == 'chrome' || location.scheme == 'about')
			return;

		/* If there are some more schemes that do not support a host */
		try {
			if (!location.host)
				return;
		} catch(ex) {
			return;
		}

		ASNQueryASNumber(location.host);

		return;
	},

	onStateChange: function(webProgress, request, stateFlags, status) {
		return;
	},

	onProgressChange: function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
		return;
	},

	onSecurityChange: function(webProgress, request, state) {
		return;
	},

	onStatusChange: function(webProgress, request, status, message) {
		return;
	},

	onLinkIconAvailable: function() {
		return;
	}
};

function ASNDNSListener(host) {
	this.host = host;

	this.onLookupComplete = function(request, record, status) {
		var ip = null;

		if (!record) {
			ASNAsyncCurrentHost = null;
			ASNFetchAS(null);

			return;
		}
		if (this.host != ASNAsyncCurrentHost) {
			ASNAsyncCurrentHost = null;
			ASNFetchAS(null);

			return;
		}

		while(record.hasMore()) {
			ip = record.getNextAddrAsString();

			if (!ASNCheckIPv4.test(ip))
				continue;

			ASNIPCache[this.host] = new ASNIPCacheObject(ip);
			ASNAsyncCurrentHost = null;
			ASNFetchAS(ASNIPCache[this.host]);

			return;
		}
		ASNAsyncCurrentHost = null;
		ASNFetchAS(null);
	}
}


/** Objects **/

function ASNIPCacheObject(ip) {
	this.b = ip.split(".");
	this.ib = new Array(parseInt(this.b[0]), parseInt(this.b[1]), parseInt(this.b[2]), parseInt(this.b[3]));

	this.fullip = ip;
	this.ip = this.b[0] + "." + this.b[1] + "." + this.b[2];

	/* This entry will expire after 8 hours */
	this.valid_until = (new Date()).getTime() + (60 * 60 * 8 * 1000);

	this.getIP = function() {
		return this.ip;
	}

	this.getFullIP = function() {
		return this.fullip;
	}

	this.isExpired = function() {
		var d = new Date();
		if (d.getTime() < this.valid_until)
			return false;

		return true;
	}

	this.isResolveable = function() {
		/* Ignore martian IP space. */

		// if (0.0.0.0/8) RFC1700
		if (this.ib[0] == 0)
			return false;

		// if (10.0.0.0/8) RFC1918
		if (this.ib[0] == 10)
			return false;

		// if (127.0.0.0/8) RFC1700
		if (this.ib[0] == 127)
			return false;

		// if (169.254.0.0/16) RFC3330
		if (this.ib[0] == 169 && this.ib[1] == 254)
			return false;

		//if (172.16.0.0/12) RFC1918
		if (this.ib[0] == 172 && this.ib[1] >= 16 && this.ib[1] <= 32)
			return false;

		// if (192.0.2.0/24) RFC3330
		if (this.ib[0] == 192 && this.ib[1] == 0 && this.ib[2] == 2)
			return false;

		//if (192.88.99.0/24) RFC3068
		if (this.ib[0] == 192 && this.ib[1] == 88 && this.ib[2] == 99)
			return false;

		// if (192.168.0.0/16) RFC1918
		if (this.ib[0] == 192 && this.ib[1] == 168)
			return false;

		//if (198.18.0.0/15) RFC2544
		if (this.ib[0] == 198 && this.ib[1] >= 18 && this.ib[1] <= 19)
			return false;

		//if (224.0.0.0/4) RFC3171
		if (this.ib[0] >= 224 && this.ib[0] <= 239)
			return false;

		//if (240.0.0.0/4) RFC1700
		if (this.ib[0] >= 240 && this.ib[0] <= 255)
			return false;

		return true;
	}
}

function ASNASCacheObject(responseDoc) {
	this.r = responseDoc;
	this.doc = document.importNode(this.r.documentElement, true);

	this.valid = true;

	/* This entry will expire in 8 hours */
	this.valid_until = (new Date()).getTime() + (60 * 60 * 8 * 1000);

	this.asnumber = null;

	this.node = this.r.getElementById("asresponse");

	if (this.node && this.node.getAttribute("asnumber")) {
		this.asnumber = this.node.getAttribute("asnumber");

		if (this.asnumber == 'AS0')
			this.valid = false;
	} else
		this.valid = false;

	this.getAS = function() {
		return this.asnumber;
	}

	this.getRIR = function() {
		var m = this.doc.textContent.match(/RIR[\s]*\:[\s]*([A-Z]+)/);
		if (m == null)
			return "";

		var db = m[1];

		if (db == 'RIPENCC')
			db = 'RIPE';

		return db;
	}

	this.isValid = function() {
		return this.valid;
	}

	this.isExpired = function() {
		var d = new Date();
		if (d.getTime() < this.valid_until)
			return false;

		return true;
	}
}


/** Functions **/

/*
 * Layout
 *
 * Event: location bar changes
 *	1. retrieve current host
 *	2. ASNFetchIP: resolve host
 *		2.1. check the cache (ASNIPCache). If found goto 3
 *		2.2. resolve host with ASNDNSResolver
 *	3. ASNFetchAS: resolve AS number. If no IP then ASNDisplayError, exit
 *		3.1. check the IP if it is resolveable. If not then ASNDisplayIP, exit
 *		3.2. check the cache (ASNASCache). If found goto 4
 *		3.3. fetch AS number. If not found then ASNDisplayIP, exit
 *	4. ASNDisplayASNumber: display AS number, exit
 */


function ASNQueryASNumber(host) {
	ASNDisplay("AS lookup", "AS Number lookup in progress", "text");

	ASNFetchIP(host);

	return;
}

function ASNFetchIP(host) {
	/* cache lookup */
	if (ASNIPCache[host]) {
		if (!ASNIPCache[host].isExpired()) {
			ASNFetchAS(ASNIPCache[host]);
			return;
		}
	}

	if (ASNDNSResolver == null) {
		ASNDNSResolver = Components.classes["@mozilla.org/network/dns-service;1"].getService();
		ASNDNSResolver.QueryInterface(Components.interfaces.nsIDNSService);
	}

	if (ASNAsync && ASNAsyncCurrentHost == null) {
		/* async */
		ASNAsyncCurrentHost = host;
		var l = new ASNDNSListener(host);
		ASNDNSRequest = ASNDNSResolver.asyncResolve(host, false, l, null);
	} else {
		/* sync */
		var record = ASNDNSResolver.resolve(host, false);
		var ip = null;

		if (!record) {
			ASNFetchAS(null);
			return;
		}

		while(record.hasMore()) {
			ip = record.getNextAddrAsString();

			if (!ASNCheckIPv4.test(ip))
				continue;

			ASNIPCache[host] = new ASNIPCacheObject(ip);

			ASNFetchAS(ASNIPCache[host]);

			return;
		}

		ASNFetchAS(null);
	}

	return;
}

function ASNFetchAS(ip) {
	if (!ip) {
		ASNDisplayError();
		return;
	}

	/* check if this IP can be resolved */
	if (!ip.isResolveable()) {
		ASNDisplayIP(ip)
		return;
	}

	/* check cache */
	if (ASNASCache[ip.getIP()]) {
		if (!ASNASCache[ip.getIP()].isExpired()) {
			ASNDisplayASNumber(ASNASCache[ip.getIP()]);
			return;
		}
	}

	var ASNXMLHttpRequest = new XMLHttpRequest();
	ASNXMLHttpRequest.open("GET", "http://" + ASNASServer + "/asnumber/asnum?ip=" + ip.getFullIP(), true);
	ASNXMLHttpRequest.overrideMimeType("text/plain");
	ASNXMLHttpRequest.myData = ip;
	ASNXMLHttpRequest.onerror = function(event) {
		var self = event.target;
		
		ASNDisplay("AS n/a", "Unable to contact ASN server or no response", "text");
	}
	ASNXMLHttpRequest.onload = function(event) {
		var self = event.target;

		if (self.status == 200) {
			var doc = "<box xmlns='http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'>" + self.responseText + "</box>";
			var xulobject = (new DOMParser()).parseFromString(doc, "application/xml");

			var ip = self.myData.getIP();
			var as = new ASNASCacheObject(xulobject);

			if (as.isValid()) {
				ASNASCache[ip] = as;
				ASNDisplayASNumber(ASNASCache[ip]);
			} else
				ASNDisplayIP(self.myData);
		} else
			ASNDisplayIP(ip);
	}

	ASNXMLHttpRequest.send(null);

	return;
}

function ASNDisplayASNumber(as) {
	if (!as)
		ASNDisplayError();
	else
		ASNDisplay(as.getAS(), as, "as");

	return;
}

function ASNDisplayIP(ip) {
	ASNDisplay("AS n/a", "IP: " + ip.getFullIP(), "text");

	return;
}

function ASNDisplayError() {
	ASNDisplay("AS n/a", "Unable to resolve AS number", "text");

	return;
}

function ASNInit() {
	/* Settings */
	ASNPrefObserver.register();
	ASNInitPrefs();

	var menuitem = document.getElementById("asnumber-context-enable");
	menuitem.setAttribute("checked", "false");

	if (ASNEnabled)
		menuitem.setAttribute("checked", "true");

	ASNDisplay("AS ready", "AS Number ready", "text");

	/* Progress Listener */
	window.getBrowser().addProgressListener(ASNProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION | Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);

	/* Cache Cleanup */
	ASNCacheCleanupInterval = setInterval("ASNCacheCleanup()", 60000);

	/* Detect the OS we are on. Needed for the Clipboard */
	var os = navigator.platform.toLowerCase();

	if (os.indexOf('win') != -1)
		ASNLineEndings = ASN_CRLF;
	else if (os.indexOf('mac') != -1)
		ASNLineEndings = ASN_CR;
	else
		ASNLineEndings = ASN_LF;

	return true;
}

function ASNExit() {
	if (ASNAsync && ASNDNSRequest != null)
		ASNDNSRequest.cancel();

	ASNPrefObserver.unregister();

	clearInterval(ASNCacheCleanupInterval);

	return true;
}

function ASNDisplay(label, tooltip, type) {
	var display = document.getElementById("asnumber-statusbar-label");
	if (!display)
		return;

	if (label.length == 0)
		label = "AS n/a";

	display.setAttribute("value", label);

	var tt = document.getElementById("asnumber-status-tooltip");
	if (tt != null) {
		while(tt.hasChildNodes())
			tt.removeChild(tt.firstChild);
	}
	
	var panel = document.getElementById("asnumber-panel-content");
	if (panel != null) {
		while(panel.hasChildNodes())
			panel.removeChild(panel.firstChild);
	}

	var node = null;

	switch(type) {
		case "as":
			if (tooltip.doc) {
				tt.appendChild(tooltip.doc);
        //panel.appendChild(tooltip.doc);

				ASNSetCurrentASNumber(tooltip);
			}

			break;
		case "text":
		default:
			if (tooltip.length == 0)
				tooltip = "AS n/a";

			node = document.createElement("label");
			node.setAttribute("value", tooltip);
			tt.appendChild(node);
			
			ASNUnsetCurrentASNumber();
			break;
	}
}

function ASNCacheCleanup() {
	/* Clean IP-Cache */
	for(var i = 0; i < ASNIPCache.length; i++) {
		if (ASNIPCache[i].isExpired())
			ASNIPCache.splice(i, 1);
	}

	/* Clean AS-Cache */
	for(var i = 0; i < ASNASCache.length; i++) {
		if (ASNASCache[i].isExpired())
			ASNASCache.splice(i, 1);
	}
}

function ASNSetCurrentASNumber(as) {
	var n = document.getElementById('asnumber-context-clipboard');
	if (n)
		n.removeAttribute('disabled');

	n = document.getElementById('asnumber-context-whois');
	if (n)
		n.removeAttribute('disabled');

	ASNCurrentASNumber = as;

	return;
}

function ASNUnsetCurrentASNumber() {
	var n = document.getElementById('asnumber-context-clipboard');
	if (n)
		n.setAttribute('disabled', 'true');

	n = document.getElementById('asnumber-context-whois');
	if (n)
		n.setAttribute('disabled', 'true');

	ASNCurrentASNumber = null;

	return;
}

function ASNCopyToClipboard() {
	if (ASNCurrentASNumber == null)
		return;

	var as = ASNCurrentASNumber.doc.textContent.replace(/(\n)/g, ASNLineEndings);

	var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
	if (!str)
		return;

	str.data = as;

	var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
	if (!trans)
		return;

	trans.addDataFlavor("text/unicode");
	trans.setTransferData("text/unicode", str, as.length * 2);

	var clipid = Components.interfaces.nsIClipboard;
	var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
	if (!clip)
		return;

	clip.setData(trans, null, clipid.kGlobalClipboard);

	return;
}

function ASNLoadWhois(s) {
	if (ASNCurrentASNumber == null)
		return;

	if (s == 'click' && ASNFastAccess == false)
		return;

	var db = ASNCurrentASNumber.getRIR();

	if (db == '')
		return;

	var url = '';

	if (db == 'ARIN')
		url = "http://whois.arin.net/rest/asn/" + ASNCurrentASNumber.getAS() + "/pft";
	else
		url = "http://www.ripe.net/fcgi-bin/whois?form_type=advanced&full_query_string=&searchtext=" + ASNCurrentASNumber.getAS() + "&inverse_attributes=None&ip_search_lvl=Default%28nearest+match%29&alt_database=" + db + "&object_type=aut-num&filter_mail=ON";

	if (ASNOpenTabs == true) {
		var oldtab = getBrowser().selectedTab;

		try {
			ASNTab.linkedBrowser.loadURI(url, null, null);
		} catch(e) {
			ASNTab = getBrowser().addTab(url, null, null, null);				
		}

		if (ASNOpenForeground == true)
			getBrowser().selectedTab = ASNTab;
		else
			getBrowser().selectedTab = oldtab;
	} else
		window.open(url);
}

function ASNGetNow() {
	var url = gURLBar.value;
	var ios = null;
	var location = null;
	
	try {
		ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		location = ios.newURI(url, null, null);
	} catch(ex) {
		return;
	}

	if (!location.scheme)
		return;

	if (location.scheme == 'file' || location.scheme == 'chrome' || location.scheme == 'about')
		return;

	/* If there are some more schemes that do not support a host */
	try {
		if (!location.host)
			return;
	} catch(ex) {
		return;
	}

	ASNUnsetCurrentASNumber();
	ASNQueryASNumber(location.host);

	return;
}

/** Settings functions **/

function ASNShowSettings() {
	window.openDialog("chrome://asnumber/content/asnumberSettings.xul", "asnumberSettings", "centerscreen,modal");
}


/** Register global callbacks **/

window.addEventListener("load", ASNInit, false);
window.addEventListener("close", ASNExit, false);
