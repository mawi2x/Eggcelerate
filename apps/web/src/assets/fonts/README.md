# Local dashboard fonts

Variable WOFF2 subsets of Baloo 2 (400–800) and Nunito (400–700), retrieved from
Google Fonts on October 3, 2026. All supplied Unicode subsets are preserved in
`src/styles/fonts.css`; browsers request only subsets needed by displayed text.
These replace the external Google Fonts stylesheet and font requests.

Source CSS request: `https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&family=Nunito:wght@400..700&display=swap`.
Files retain Google Fonts names/versioned contents. Upstream SIL Open Font License
files are included as `baloo2-OFL.txt` and `nunito-OFL.txt`, obtained from the
corresponding `ofl` directories in `https://github.com/google/fonts`.

Review licensing, Unicode ranges, sizes, and asset budgets when updating fonts.
