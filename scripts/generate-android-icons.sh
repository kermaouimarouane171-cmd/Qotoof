#!/bin/bash
set -e

ANDROID_RES="android/app/src/main/res"

# Create SVG for icon (green circle with white "ق")
create_icon_svg() {
  local size=$1
  cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size}/2" cy="${size}/2" r="${size}/2" fill="#16a34a"/>
  <text x="${size}/2" y="${size}/2" font-family="Cairo, Tajawal, Arial, sans-serif" font-size="$((size * 58 / 100))" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" dy="$((size * 5 / 100))">ق</text>
</svg>
EOF
}

create_foreground_svg() {
  local size=$1
  cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text x="${size}/2" y="${size}/2" font-family="Cairo, Tajawal, Arial, sans-serif" font-size="$((size * 62 / 100))" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" dy="$((size * 5 / 100))">ق</text>
</svg>
EOF
}

create_splash_svg() {
  cat <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#16a34a"/>
  <text x="540" y="960" font-family="Cairo, Tajawal, Arial, sans-serif" font-size="420" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" dy="20">ق</text>
</svg>
EOF
}

# Generate icons for each density
declare -A SIZES=(
  ["mipmap-mdpi"]=48
  ["mipmap-hdpi"]=72
  ["mipmap-xhdpi"]=96
  ["mipmap-xxhdpi"]=144
  ["mipmap-xxxhdpi"]=192
)

declare -A FG_SIZES=(
  ["mipmap-mdpi"]=108
  ["mipmap-hdpi"]=162
  ["mipmap-xhdpi"]=216
  ["mipmap-xxhdpi"]=324
  ["mipmap-xxxhdpi"]=432
)

for dir in "${!SIZES[@]}"; do
  size=${SIZES[$dir]}
  outdir="${ANDROID_RES}/${dir}"
  mkdir -p "$outdir"

  create_icon_svg "$size" | rsvg-convert -f png -o "${outdir}/ic_launcher.png" /dev/stdin
  create_icon_svg "$size" | rsvg-convert -f png -o "${outdir}/ic_launcher_round.png" /dev/stdin
  echo "Generated ${dir}/ic_launcher.png (${size}x${size})"
done

for dir in "${!FG_SIZES[@]}"; do
  size=${FG_SIZES[$dir]}
  outdir="${ANDROID_RES}/${dir}"
  mkdir -p "$outdir"

  create_foreground_svg "$size" | rsvg-convert -f png -o "${outdir}/ic_launcher_foreground.png" /dev/stdin
  echo "Generated ${dir}/ic_launcher_foreground.png (${size}x${size})"
done

# Generate splash
mkdir -p "${ANDROID_RES}/drawable"
create_splash_svg | rsvg-convert -f png -o "${ANDROID_RES}/drawable/splash.png" /dev/stdin
echo "Generated drawable/splash.png (1080x1920)"

echo ""
echo "All icons generated successfully!"
