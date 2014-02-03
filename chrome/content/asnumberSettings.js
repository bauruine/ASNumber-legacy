function ASNInitPrefs() {
	ASNEnabled = ASNGetBoolPref("enabled", true);
	ASNAsync = ASNGetBoolPref("async", false);
	ASNASServer = ASNGetCharPref("server", "asnumber.tuxli.ch");
	ASNOpenTabs = ASNGetBoolPref("openintabs", true);
	ASNOpenForeground = ASNGetBoolPref("opentabsinforeground", false);
	ASNFastAccess = ASNGetBoolPref("fastaccess", false);
}

function ASNSwitchEnable() {
	ASNEnabled = !ASNEnabled;

	var menuitem = document.getElementById("asnumber-context-enable");
	var getas = document.getElementById("asnumber-context-load");

	/* save settings */
	ASNSetBoolPref("enabled", ASNEnabled);

	if (ASNEnabled) {
		menuitem.setAttribute("checked", "true");
		getas.setAttribute("disabled", "true");
	} else {
		menuitem.setAttribute("checked", "false");
		getas.removeAttribute("disabled");

		ASNDisplay("", "");
	}
}

function ASNSaveSettings() {
	var async = false;
	var tabs = true;
	var foreground = false;
	var fastaccess = false;

	var dns = document.getElementById("asnumber-options-dns");
	if (dns.selectedItem.value == "sync")
		async = false;
	else
		async = true;

	ASNSetBoolPref("async", async);

	var s = document.getElementById("asnumber-options-server");
	server = s.selectedItem.value;

	ASNSetCharPref("server", server);

	var radio = document.getElementById("asnumber-whois-open-window");
	if (radio.selected == true)
		tabs = false;

	radio = document.getElementById("asnumber-whois-open-tab");
	if (radio.selected == true)
		tabs = true;

	ASNSetBoolPref("openintabs", tabs);

	var box = document.getElementById("asnumber-whois-open-tab-foreground");
	if (box.checked == true)
		foreground = true;

	ASNSetBoolPref("opentabsinforeground", foreground);

	box = document.getElementById("asnumber-whois-fast-access");
	if (box.checked == true)
		fastaccess = true;

	ASNSetBoolPref("fastaccess", fastaccess);

	return true;
}

function ASNLoadSettings() {
	var async = ASNGetBoolPref("async", false);

	var rsync = document.getElementById("asnumber-options-sync");
	var rasync = document.getElementById("asnumber-options-async");

	if (async == false) {
		rsync.setAttribute("selected", "true");
		rasync.setAttribute("selected", "false");
	} else {
		rsync.setAttribute("selected", "false");
		rasync.setAttribute("selected", "true");
	}

	var server = ASNGetCharPref("server", "eu.asnumber.networx.ch");

	var s = document.getElementById("asnumber-options-server");
	var sel = document.getElementById("asnumber-options-server-selection");

	for(var i = 0; i < sel.childNodes.length; i++) {
		if (sel.childNodes[i].value == server) {
			s.selectedIndex = i;
			break;
		}
	}

	var tabs = ASNGetBoolPref("openintabs", true);
	var foreground = ASNGetBoolPref("opentabsinforeground", false);

	var radio = null;
	if (tabs == false)
		var radio = document.getElementById("asnumber-whois-open-window");
	else
		var radio = document.getElementById("asnumber-whois-open-tab");

	if (radio)
		radio.setAttribute("selected", "true");

	var box = document.getElementById("asnumber-whois-open-tab-foreground");
	box.checked = foreground;
	box.disabled = !tabs;

	var fastaccess = ASNGetBoolPref("fastaccess", false);

	box = document.getElementById("asnumber-whois-fast-access");
	box.checked = fastaccess;

	return true;
}

function ASNGetBoolPref(name, defval) {
	var pref = defval;

	var prefservice = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	var prefs = prefservice.getBranch("asnumber.");

	if (prefs.getPrefType(name) == prefs.PREF_BOOL)
		pref = prefs.getBoolPref(name);

	return pref;
}

function ASNSetBoolPref(name, value) {
	var prefservice = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	var prefs = prefservice.getBranch("asnumber.");

	prefs.setBoolPref(name, value);

	return true;
}

function ASNGetCharPref(name, defval) {
	var pref = defval;

	var prefservice = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	var prefs = prefservice.getBranch("asnumber.");

	if (prefs.getPrefType(name) == prefs.PREF_STRING)
		pref = prefs.getCharPref(name);

	return pref;
}

function ASNSetCharPref(name, value) {
	var prefservice = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	var prefs = prefservice.getBranch("asnumber.");

	prefs.setCharPref(name, value);

	return true;
}

function ASNCheckWhoisOpen() {
	var radio = document.getElementById("asnumber-whois-open-window");
	var box = document.getElementById("asnumber-whois-open-tab-foreground");

	if (radio && box) {
		box.disabled = radio.selected;
	}
}

var ASNPrefObserver = {
	prefs: null,

	register: function() {
		var prefservice = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		this.prefs = prefservice.getBranch("asnumber.");

		var internal = this.prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
		internal.addObserver("", this, false);
	},
	unregister: function() {
		if (!this.prefs)
			return;

		var internal = this.prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
		internal.removeObserver("", this);
	},
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed")
			return;

		ASNInitPrefs();
	}
}
