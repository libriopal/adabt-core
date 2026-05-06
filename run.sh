#!/usr/bin/env bash

API_URL=${API_URL:-"http://localhost:3001/api"}

function header() {
  clear
  echo "====================================="
  echo "   SlotGPT Debug Terminal UI"
  echo "====================================="
  echo "API: $API_URL"
  echo ""
}

function pause() {
  echo ""
  read -p "Press Enter to continue..."
}

function request() {
  local method=$1
  local endpoint=$2
  local data=$3

  echo ">>> $method $endpoint"
  echo ">>> Payload: $data"
  echo ""

  if [ "$method" == "GET" ]; then
    curl -s -w "\n\n[STATUS: %{http_code}]\n" "$API_URL$endpoint" | jq .
  else
    curl -s -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\n\n[STATUS: %{http_code}]\n" \
      "$API_URL$endpoint" | jq .
  fi
}

# =========================
# ACTIONS
# =========================

function generate_batch() {
  read -p "Batch size: " size
  request POST "/generate-batch" "{\"size\": $size}"
  pause
}

function evolve() {
  read -p "Epochs: " epochs
  request POST "/evolve" "{\"epochs\": $epochs}"
  pause
}

function get_designs() {
  request GET "/designs"
  pause
}

function get_demand() {
  request GET "/demand"
  pause
}

function import_design() {
  read -p "Path to JSON file: " file
  data=$(cat "$file")
  request POST "/import" "$data"
  pause
}

function export_design() {
  read -p "Design ID: " id
  request GET "/export/$id"
  pause
}

function health() {
  request GET "/health"
  pause
}

# =========================
# MAIN LOOP
# =========================

while true; do
  header
  echo "1) Generate Batch"
  echo "2) Evolve"
  echo "3) Get Designs"
  echo "4) Get Demand"
  echo "5) Import Design"
  echo "6) Export Design"
  echo "7) Health Check"
  echo "8) Custom Curl"
  echo "0) Exit"
  echo ""

  read -p "Select option: " choice

  case $choice in
    1) generate_batch ;;
    2) evolve ;;
    3) get_designs ;;
    4) get_demand ;;
    5) import_design ;;
    6) export_design ;;
    7) health ;;
    8)
      read -p "Method (GET/POST): " m
      read -p "Endpoint: " e
      read -p "JSON Body (or empty): " b
      request "$m" "$e" "$b"
      pause
      ;;
    0) exit 0 ;;
    *) echo "Invalid option"; sleep 1 ;;
  esac
done