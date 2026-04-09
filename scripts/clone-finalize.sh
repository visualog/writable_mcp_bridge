#!/bin/zsh
set -euo pipefail

API='http://127.0.0.1:3846'
CURL_BIN='/usr/bin/curl'
JQ_BIN='/usr/bin/jq'
PLUGIN='page:33023:62'

ROOT='33092:1755'
SIDEBAR='33092:1756'
TOPBAR='33092:1757'
KPI1='33092:1773'
KPI1_TITLE='33092:1774'
KPI1_BODY='33092:1775'
KPI2='33092:1776'
KPI2_TITLE='33092:1777'
KPI2_BODY='33092:1778'
KPI3='33092:1779'
KPI3_TITLE='33092:1780'
KPI3_BODY='33092:1781'
TIMELINE='33092:1782'
TL_TITLE='33092:1783'
TL_BODY='33092:1784'
TABLE='33092:1785'
TB_TITLE='33092:1786'
TB_BODY='33092:1787'
ACTIONS='33092:1763'

post() {
  local path="$1"
  local payload="$2"
  "$CURL_BIN" -s -X POST "$API$path" -H 'Content-Type: application/json' -d "$payload"
}

update_node() {
  post /api/update-node "$1" >/dev/null
}

create_text() {
  local parent="$1"
  local name="$2"
  local text="$3"
  local x="$4"
  local y="$5"
  local w="$6"
  local h="$7"
  local size="$8"
  local style="$9"
  post /api/create-node "$("$JQ_BIN" -nc \
    --arg pluginId "$PLUGIN" \
    --arg parentId "$parent" \
    --arg name "$name" \
    --arg characters "$text" \
    --arg fontStyle "$style" \
    --argjson x "$x" \
    --argjson y "$y" \
    --argjson width "$w" \
    --argjson height "$h" \
    --argjson fontSize "$size" \
    '{pluginId:$pluginId,parentId:$parentId,nodeType:"TEXT",name:$name,characters:$characters,fontFamily:"SF Compact Text",fontStyle:$fontStyle,fontSize:$fontSize,x:$x,y:$y,width:$width,height:$height}')" \
    | "$JQ_BIN" -r '.result.created.id'
}

create_rect() {
  local parent="$1"
  local name="$2"
  local x="$3"
  local y="$4"
  local w="$5"
  local h="$6"
  local fill="$7"
  local radius="$8"
  post /api/create-node "$("$JQ_BIN" -nc \
    --arg pluginId "$PLUGIN" \
    --arg parentId "$parent" \
    --arg name "$name" \
    --arg fillColor "$fill" \
    --argjson x "$x" \
    --argjson y "$y" \
    --argjson width "$w" \
    --argjson height "$h" \
    --argjson cornerRadius "$radius" \
    '{pluginId:$pluginId,parentId:$parentId,nodeType:"RECTANGLE",name:$name,fillColor:$fillColor,x:$x,y:$y,width:$width,height:$height,cornerRadius:$cornerRadius}')" \
    | "$JQ_BIN" -r '.result.created.id'
}

update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$ROOT" '{pluginId:$pluginId,nodeId:$nodeId,width:1440,height:1024,fillColor:"#F7F8FA"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$SIDEBAR" '{pluginId:$pluginId,nodeId:$nodeId,x:24,y:24,width:250,height:976,fillColor:"#FFFFFF",cornerRadius:20}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TOPBAR" '{pluginId:$pluginId,nodeId:$nodeId,x:298,y:24,width:1118,height:56,fillColor:"#FFFFFF",cornerRadius:16}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI1" '{pluginId:$pluginId,nodeId:$nodeId,x:298,y:104,width:350,height:176,fillColor:"#FFFFFF",cornerRadius:24}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI2" '{pluginId:$pluginId,nodeId:$nodeId,x:666,y:104,width:350,height:176,fillColor:"#FFFFFF",cornerRadius:24}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI3" '{pluginId:$pluginId,nodeId:$nodeId,x:1034,y:104,width:382,height:176,fillColor:"#FFFFFF",cornerRadius:24}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TIMELINE" '{pluginId:$pluginId,nodeId:$nodeId,x:298,y:300,width:1118,height:296,fillColor:"#FFFFFF",cornerRadius:24}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TABLE" '{pluginId:$pluginId,nodeId:$nodeId,x:298,y:620,width:1118,height:380,fillColor:"#FFFFFF",cornerRadius:24}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$ACTIONS" '{pluginId:$pluginId,nodeId:$nodeId,visible:false}')"

update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI1_TITLE" --arg characters 'Overall Tasks' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:18,width:220,height:24,fontSize:20,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI1_BODY" --arg characters 'Spread across 6 projects.' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:44,width:200,height:20,fontSize:14,fontFamily:"SF Compact Text",fontStyle:"Regular"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI2_TITLE" --arg characters 'Project Track' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:18,width:220,height:24,fontSize:20,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI2_BODY" --arg characters 'Project performance status' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:44,width:220,height:20,fontSize:14,fontFamily:"SF Compact Text",fontStyle:"Regular"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI3_TITLE" --arg characters 'Project Progress' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:18,width:220,height:24,fontSize:20,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$KPI3_BODY" --arg characters 'Overall completion rate all projects.' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:44,width:260,height:20,fontSize:14,fontFamily:"SF Compact Text",fontStyle:"Regular"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TL_TITLE" --arg characters 'Project Timeline' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:18,width:240,height:24,fontSize:20,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TL_BODY" --arg characters 'Visualize your project schedule, milestones, and deadlines in a chronological view.' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:44,width:520,height:20,fontSize:14,fontFamily:"SF Compact Text",fontStyle:"Regular"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TB_TITLE" --arg characters 'Project List' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:18,width:240,height:24,fontSize:20,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId "$TB_BODY" --arg characters 'See all your projects in one place organized, searchable, and easy to manage.' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:20,y:44,width:520,height:20,fontSize:14,fontFamily:"SF Compact Text",fontStyle:"Regular"}')"
update_node "$("$JQ_BIN" -nc --arg pluginId "$PLUGIN" --arg nodeId '33092:1772' --arg characters 'Trackline.' '{pluginId:$pluginId,nodeId:$nodeId,characters:$characters,x:12,y:8,width:160,height:28,fontSize:26,fontFamily:"SF Compact Text",fontStyle:"Semibold"}')"

create_rect "$SIDEBAR" 'workspace-card' 0 56 250 72 '#F7F8FA' 16 >/dev/null
create_text "$SIDEBAR" 'workspace-title' 'Aerobox Workspace' 72 70 140 18 13 'Regular' >/dev/null
create_text "$SIDEBAR" 'workspace-name' 'Project Team' 72 88 140 24 20 'Semibold' >/dev/null
create_rect "$SIDEBAR" 'avatar-bg' 16 68 40 40 '#8B7CF6' 12 >/dev/null
create_text "$SIDEBAR" 'avatar-letter' 'A' 31 74 18 28 22 'Semibold' >/dev/null
create_rect "$SIDEBAR" 'search-box' 0 144 250 44 '#F7F8FA' 14 >/dev/null
create_text "$SIDEBAR" 'search-placeholder' 'Search' 18 156 80 20 15 'Regular' >/dev/null
create_text "$SIDEBAR" 'main-menu-label' 'Main menu' 0 208 90 18 13 'Regular' >/dev/null
create_rect "$SIDEBAR" 'menu-active' 0 232 250 48 '#F7F8FA' 14 >/dev/null
create_text "$SIDEBAR" 'menu-dashboard' 'Dashboard' 18 246 100 20 16 'Medium' >/dev/null
create_text "$SIDEBAR" 'menu-teams' 'Teams' 18 298 80 20 16 'Regular' >/dev/null
create_text "$SIDEBAR" 'menu-calendar' 'Calendar' 18 342 90 20 16 'Regular' >/dev/null
create_text "$SIDEBAR" 'menu-tracker' 'Time Tracker' 18 386 110 20 16 'Regular' >/dev/null
create_text "$SIDEBAR" 'menu-my-task' 'My Task' 18 430 80 20 16 'Regular' >/dev/null
create_text "$SIDEBAR" 'menu-settings' 'Settings' 18 474 80 20 16 'Regular' >/dev/null

create_rect "$TOPBAR" 'breadcrumb-box' 0 0 1118 56 '#FFFFFF' 16 >/dev/null
create_text "$TOPBAR" 'breadcrumb' 'Dashboard' 24 16 180 24 18 'Semibold' >/dev/null

create_text "$KPI1" 'tasks-heading' 'Tasks' 20 74 90 30 28 'Semibold' >/dev/null
create_text "$KPI1" 'tasks-value' '23' 300 74 32 30 28 'Semibold' >/dev/null
create_rect "$KPI1" 'bar-blue' 20 116 196 16 '#5B8DEF' 8 >/dev/null
create_rect "$KPI1" 'bar-orange' 224 116 74 16 '#FFB65C' 8 >/dev/null
create_rect "$KPI1" 'bar-green' 304 116 26 16 '#57D39B' 8 >/dev/null
create_text "$KPI1" 'legend-1' 'On Going  12' 20 144 120 18 14 'Regular' >/dev/null
create_text "$KPI1" 'legend-2' 'Under Review  6' 150 144 130 18 14 'Regular' >/dev/null
create_text "$KPI1" 'legend-3' 'Finish  4' 286 144 70 18 14 'Regular' >/dev/null

create_text "$KPI2" 'metric-value' '4892' 20 74 120 52 52 'Semibold' >/dev/null
create_text "$KPI2" 'metric-unit' 'Referral' 166 96 100 26 28 'Medium' >/dev/null
create_text "$KPI2" 'metric-delta' '+12.2%' 278 78 56 18 16 'Semibold' >/dev/null
create_rect "$KPI2" 'jan-a' 20 132 22 34 '#FFB65C' 8 >/dev/null
create_rect "$KPI2" 'jan-b' 48 114 22 52 '#5B8DEF' 8 >/dev/null
create_rect "$KPI2" 'jan-c' 76 108 22 58 '#57D39B' 8 >/dev/null
create_rect "$KPI2" 'feb-a' 146 118 22 48 '#FFB65C' 8 >/dev/null
create_rect "$KPI2" 'feb-b' 174 98 22 68 '#5B8DEF' 8 >/dev/null
create_rect "$KPI2" 'feb-c' 202 112 22 54 '#57D39B' 8 >/dev/null
create_rect "$KPI2" 'mar-a' 270 120 22 46 '#FFB65C' 8 >/dev/null
create_rect "$KPI2" 'mar-b' 298 106 22 60 '#5B8DEF' 8 >/dev/null
create_rect "$KPI2" 'mar-c' 326 128 22 38 '#57D39B' 8 >/dev/null

create_text "$KPI3" 'progress-1-label' 'Performing Progress' 20 82 180 18 14 'Medium' >/dev/null
create_text "$KPI3" 'progress-1-value' '89%' 338 82 30 18 16 'Semibold' >/dev/null
create_text "$KPI3" 'progress-2-label' 'Target Sales' 20 132 120 18 14 'Medium' >/dev/null
create_text "$KPI3" 'progress-2-value' '67%' 338 132 30 18 16 'Semibold' >/dev/null
for i in {0..23}; do
  x=$((20 + i * 14))
  if [ "$i" -ge 21 ]; then
    create_rect "$KPI3" "prog1-$i" "$x" 106 8 28 '#E9EDF5' 4 >/dev/null
  else
    create_rect "$KPI3" "prog1-$i" "$x" 106 8 28 '#57D39B' 4 >/dev/null
  fi
  if [ "$i" -lt 18 ]; then
    create_rect "$KPI3" "prog2-$i" "$x" 156 8 28 '#5B8DEF' 4 >/dev/null
  else
    create_rect "$KPI3" "prog2-$i" "$x" 156 8 28 '#E9EDF5' 4 >/dev/null
  fi
done

for h in 8 9 10 11 12 13 14 15 16 17; do
  xpos=$((20 + (h - 8) * 108))
  label=$(printf '%02d:00' "$h")
  create_text "$TIMELINE" "hour-$h" "$label" "$xpos" 88 60 16 12 'Regular' >/dev/null
done
create_rect "$TIMELINE" 'event-1' 40 124 260 32 '#D8E9FF' 16 >/dev/null
create_text "$TIMELINE" 'event-1-text' 'Meeting Brief Project' 54 132 180 16 13 'Medium' >/dev/null
create_rect "$TIMELINE" 'event-2' 314 166 260 32 '#F0E5FF' 16 >/dev/null
create_text "$TIMELINE" 'event-2-text' 'Research Analyze Content' 328 174 190 16 13 'Medium' >/dev/null
create_rect "$TIMELINE" 'event-3' 40 208 350 34 '#DDF7EA' 17 >/dev/null
create_text "$TIMELINE" 'event-3-text' 'Build Website & Mobile Responsive' 54 217 240 16 13 'Medium' >/dev/null
create_rect "$TIMELINE" 'event-4' 620 124 240 32 '#D8E9FF' 16 >/dev/null
create_text "$TIMELINE" 'event-4-text' 'Internal Meeting' 634 132 130 16 13 'Medium' >/dev/null
create_rect "$TIMELINE" 'event-5' 860 166 250 32 '#FFF0D8' 16 >/dev/null
create_text "$TIMELINE" 'event-5-text' 'Review & Feedback' 874 174 150 16 13 'Medium' >/dev/null
create_rect "$TIMELINE" 'event-6' 860 208 220 34 '#DDF7EA' 17 >/dev/null
create_text "$TIMELINE" 'event-6-text' 'Design System' 874 217 120 16 13 'Medium' >/dev/null

create_rect "$TABLE" 'search-box' 786 16 180 36 '#F7F8FA' 12 >/dev/null
create_text "$TABLE" 'search-text' 'Search task...' 804 26 100 16 14 'Regular' >/dev/null
create_rect "$TABLE" 'filter-box' 978 16 84 36 '#F7F8FA' 12 >/dev/null
create_text "$TABLE" 'filter-text' 'Filter' 1004 26 40 16 14 'Medium' >/dev/null
create_rect "$TABLE" 'new-task-box' 1072 16 120 36 '#111827' 12 >/dev/null
create_text "$TABLE" 'new-task-text' 'New Task' 1106 26 60 16 14 'Medium' >/dev/null
create_text "$TABLE" 'head-project' 'Project name' 20 94 120 16 13 'Medium' >/dev/null
create_text "$TABLE" 'head-due' 'Due task' 320 94 90 16 13 'Medium' >/dev/null
create_text "$TABLE" 'head-source' 'Source File' 490 94 90 16 13 'Medium' >/dev/null
create_text "$TABLE" 'head-team' 'Assigned Teams' 760 94 120 16 13 'Medium' >/dev/null
create_text "$TABLE" 'head-status' 'Status' 930 94 50 16 13 'Medium' >/dev/null
create_text "$TABLE" 'head-progress' 'Progress' 1020 94 60 16 13 'Medium' >/dev/null

rows=(
  "Vortex|Sept 24, 2025|Brief Project|4|Active|40%"
  "Energy|Sept 24, 2025|Brief Logo|4|Active|70%"
  "Eyez|Sept 24, 2025|AI Brief|6|Active|90%"
  "Pixel|Sept 24, 2025|Assets|5|Active|80%"
)

i=0
for row in "${rows[@]}"; do
  y=$((126 + i * 56))
  IFS='|' read -r name due src team row_status prog <<< "$row"
  create_rect "$TABLE" "row-bg-$i" 16 "$y" 1086 44 '#FFFFFF' 10 >/dev/null
  create_text "$TABLE" "row-name-$i" "$name" 32 $((y + 12)) 140 18 14 'Medium' >/dev/null
  create_text "$TABLE" "row-due-$i" "$due" 320 $((y + 12)) 120 18 14 'Regular' >/dev/null
  create_text "$TABLE" "row-src-$i" "$src" 490 $((y + 12)) 120 18 14 'Regular' >/dev/null
  create_text "$TABLE" "row-team-$i" "+$team" 804 $((y + 12)) 30 18 14 'Regular' >/dev/null
  create_text "$TABLE" "row-status-$i" "$row_status" 930 $((y + 12)) 60 18 14 'Regular' >/dev/null
  create_text "$TABLE" "row-progress-$i" "$prog" 1020 $((y + 12)) 50 18 14 'Regular' >/dev/null
  i=$((i + 1))
done

echo done
