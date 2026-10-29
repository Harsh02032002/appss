import React, { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { fonts, radius, typeScale, useTheme } from "@/src/theme";

export type Point = { lat: number; lng: number };

type Props = {
  rider: Point | null;
  restaurant: Point | null;
  customer: Point | null;
  /** Which leg to route: rider -> restaurant (pickup) or rider -> customer (drop) */
  leg: "pickup" | "drop";
  height?: number;
};

/**
 * Free map: Leaflet + OpenStreetMap tiles inside a WebView (no API key).
 * Route via the public OSRM demo server (fair-use, one request per leg change);
 * falls back to a straight dashed line when routing is unavailable.
 */
export function LeafletMap({ rider, restaurant, customer, leg, height = 260 }: Props) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);

  const html = useMemo(() => buildHtml(colors.brandPrimary), [colors.brandPrimary]);

  const payload = JSON.stringify({ rider, restaurant, customer, leg });

  useEffect(() => {
    const js = `window.__update && window.__update(${payload}); true;`;
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    } else {
      webRef.current?.injectJavaScript(js);
    }
  }, [payload]);

  if (Platform.OS === "web") {
    // react-native-webview has no web build; a plain iframe with srcDoc gives the same Leaflet map.
    const Iframe = "iframe" as any;
    return (
      <View style={[styles.wrap, { height, borderColor: colors.border }]} testID="rider-map">
        <Iframe ref={iframeRef} srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} onLoad={() => iframeRef.current?.contentWindow?.postMessage(payload, "*")} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]} testID="rider-map">
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => webRef.current?.injectJavaScript(`window.__update && window.__update(${payload}); true;`)}
        style={{ flex: 1, backgroundColor: "transparent" }}
        renderError={() => (
          <View style={styles.err}>
            <Text style={{ fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.muted }}>Map unavailable offline</Text>
          </View>
        )}
      />
    </View>
  );
}

function buildHtml(accent: string) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;width:100%;background:#F3EFE8}
.pin{width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:15px}
.leaflet-control-attribution{font-size:9px}</style></head>
<body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([12.9716,77.5946],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
function icon(bg,emoji){return L.divIcon({className:'',html:'<div class="pin" style="background:'+bg+'">'+emoji+'</div>',iconSize:[30,30],iconAnchor:[15,15]});}
var riderM=null,restM=null,custM=null,route=null,lastKey='',fitted=false;
function setMarker(m,p,ic){if(!p){if(m){map.removeLayer(m);}return null;}if(m){m.setLatLng([p.lat,p.lng]);return m;}return L.marker([p.lat,p.lng],{icon:ic}).addTo(map);}
async function drawRoute(a,b){
  var key=a.lat.toFixed(3)+','+a.lng.toFixed(3)+'>'+b.lat.toFixed(3)+','+b.lng.toFixed(3);
  if(key===lastKey)return;lastKey=key;
  if(route){map.removeLayer(route);route=null;}
  try{
    var ctrl=new AbortController();setTimeout(function(){ctrl.abort();},6000);
    var r=await fetch('https://router.project-osrm.org/route/v1/driving/'+a.lng+','+a.lat+';'+b.lng+','+b.lat+'?overview=full&geometries=geojson',{signal:ctrl.signal});
    var j=await r.json();
    if(j.routes&&j.routes[0]){route=L.geoJSON(j.routes[0].geometry,{style:{color:'${accent}',weight:5,opacity:.9}}).addTo(map);
      var km=(j.routes[0].distance/1000).toFixed(1),min=Math.round(j.routes[0].duration/60);
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({km:km,min:min}));return;}
  }catch(e){}
  route=L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'${accent}',weight:4,dashArray:'8 8'}).addTo(map);
}
window.__update=function(d){
  riderM=setMarker(riderM,d.rider,icon('${accent}','🛵'));
  restM=setMarker(restM,d.restaurant,icon('#145A43','🍽'));
  custM=setMarker(custM,d.customer,icon('#2E7D32','🏠'));
  var dest=d.leg==='pickup'?d.restaurant:d.customer;
  var pts=[d.rider,d.restaurant,d.customer].filter(Boolean).map(function(p){return [p.lat,p.lng];});
  if(pts.length&&!fitted){map.fitBounds(L.latLngBounds(pts).pad(0.25));fitted=pts.length>1;}
  if(d.rider&&dest){drawRoute(d.rider,dest);}else if(route){map.removeLayer(route);route=null;lastKey='';}
};
window.addEventListener('message',function(e){try{window.__update(typeof e.data==='string'?JSON.parse(e.data):e.data);}catch(err){}});
</script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1 },
  err: { flex: 1, alignItems: "center", justifyContent: "center" },
});
