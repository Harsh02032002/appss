import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { radius, useTheme } from "@/src/theme";

export type LatLng = { lat: number; lng: number };

type Props = {
  restaurant: LatLng;
  destination: LatLng;
  rider: LatLng | null;
  showRider: boolean;
};

/** Native live map using Leaflet + OpenStreetMap in a WebView (no Google Maps API key required). */
export function LiveMap({ restaurant, destination, rider, showRider }: Props) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => buildHtml(colors.brandPrimary), [colors.brandPrimary]);
  const payload = JSON.stringify({
    restaurant,
    destination,
    rider: showRider ? rider : null,
  });

  useEffect(() => {
    webRef.current?.injectJavaScript(`window.__update && window.__update(${payload}); true;`);
  }, [payload]);

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]} testID="track-map">
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => webRef.current?.injectJavaScript(`window.__update && window.__update(${payload}); true;`)}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function buildHtml(accent: string) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;width:100%;background:#FDFBF7}
.pin{width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:15px}
.leaflet-control-attribution{font-size:9px}</style></head>
<body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([12.9716,77.5946],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
function icon(bg,emoji){return L.divIcon({className:'',html:'<div class="pin" style="background:'+bg+'">'+emoji+'</div>',iconSize:[30,30],iconAnchor:[15,15]});}
var restM=null,destM=null,riderM=null,route=null,fitted=false;
function setMarker(m,p,ic){if(!p){if(m){map.removeLayer(m);}return null;}if(m){m.setLatLng([p.lat,p.lng]);return m;}return L.marker([p.lat,p.lng],{icon:ic}).addTo(map);}
window.__update=function(d){
  restM=setMarker(restM,d.restaurant,icon('#145A43','🍽'));
  destM=setMarker(destM,d.destination,icon('#2E7D32','🏠'));
  riderM=setMarker(riderM,d.rider,icon('${accent}','🛵'));
  if(d.restaurant&&d.destination){
    if(route){map.removeLayer(route);}
    route=L.polyline([[d.restaurant.lat,d.restaurant.lng],[d.destination.lat,d.destination.lng]],{color:'${accent}',weight:4,dashArray:'8 6'}).addTo(map);
    if(!fitted){map.fitBounds(L.latLngBounds([[d.restaurant.lat,d.restaurant.lng],[d.destination.lat,d.destination.lng]]).pad(0.25));fitted=true;}
  }
};
</script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1 },
});
