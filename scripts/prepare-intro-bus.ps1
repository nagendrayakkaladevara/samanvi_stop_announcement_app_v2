# Reproduce the actual-photo cutout on Windows without a cloud service or new dependencies.
# The hand-traced silhouette is specific to the user's 865 x 466 source photograph.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class IntroBusCutout {
  public static void Generate(string root) {
    string folder = Path.Combine(root, "assets", "intro");
    using (var source = new Bitmap(Path.Combine(folder, "samanvi-bus-original.png"))) {
      if (source.Width != 865 || source.Height != 466)
        throw new InvalidOperationException("The traced mask requires the original 865 x 466 photograph.");
      using (var outline = new GraphicsPath()) {
        // Roof, AC housing and upper-front silhouette. All interior photo pixels remain untouched.
        outline.AddBezier(40, 31, 41, 19, 55, 18, 77, 16);
        outline.AddBezier(77, 16, 120, 9, 159, 11, 195, 14);
        outline.AddLine(195, 14, 259, 21);
        outline.AddLine(259, 21, 258, 30);
        outline.AddBezier(258, 30, 264, 23, 279, 21, 296, 24);
        outline.AddBezier(296, 24, 339, 20, 374, 22, 413, 25);
        outline.AddBezier(413, 25, 463, 26, 496, 27, 519, 33);
        outline.AddBezier(519, 33, 533, 35, 545, 40, 544, 48);
        outline.AddLine(544, 48, 514, 50);
        outline.AddLine(514, 50, 515, 55);
        outline.AddLine(515, 55, 621, 58);
        outline.AddLine(621, 58, 621, 63);
        outline.AddBezier(621, 63, 656, 64, 695, 64, 728, 71);
        outline.AddBezier(728, 71, 760, 77, 775, 96, 779, 125);
        // Exterior mirror arm and mirror. The gap behind it is outside this contour.
        outline.AddBezier(779, 125, 801, 121, 820, 124, 829, 133);
        outline.AddBezier(829, 133, 837, 145, 839, 160, 839, 178);
        outline.AddLine(839, 178, 841, 201);
        outline.AddBezier(841, 201, 842, 208, 837, 211, 830, 211);
        outline.AddLine(830, 211, 821, 209);
        outline.AddLine(821, 209, 819, 195);
        outline.AddLine(819, 195, 819, 176);
        outline.AddBezier(819, 176, 819, 156, 813, 141, 794, 141);
        outline.AddLine(794, 141, 789, 143);
        outline.AddBezier(789, 143, 791, 175, 793, 207, 794, 242);
        outline.AddBezier(794, 242, 797, 267, 800, 283, 801, 301);
        outline.AddLine(801, 301, 797, 353);
        outline.AddLine(797, 353, 796, 419);
        outline.AddBezier(796, 419, 798, 429, 789, 431, 775, 434);
        // Bumper, tow tassel, underbody, front tyre and mud flap.
        outline.AddLine(775, 434, 758, 437);
        outline.AddLine(758, 437, 737, 435);
        outline.AddLine(737, 435, 726, 441);
        outline.AddLine(726, 441, 637, 445);
        outline.AddLine(637, 445, 630, 445);
        outline.AddBezier(630, 445, 629, 452, 628, 458, 624, 457);
        outline.AddBezier(624, 457, 619, 455, 622, 447, 623, 441);
        outline.AddLine(623, 441, 588, 451);
        outline.AddLine(588, 451, 548, 457);
        outline.AddLine(548, 457, 506, 444);
        outline.AddLine(506, 444, 469, 432);
        outline.AddBezier(469, 432, 465, 449, 456, 462, 444, 462);
        outline.AddBezier(444, 462, 430, 462, 421, 447, 418, 431);
        outline.AddLine(418, 431, 414, 439);
        outline.AddLine(414, 439, 405, 436);
        outline.AddLine(405, 436, 405, 412);
        outline.AddLine(405, 412, 185, 354);
        // Rear tyre / mud flap, then the rear body panel.
        outline.AddBezier(185, 354, 185, 373, 178, 385, 166, 387);
        outline.AddBezier(166, 387, 152, 389, 145, 374, 142, 359);
        outline.AddLine(142, 359, 138, 367);
        outline.AddLine(138, 367, 137, 338);
        outline.AddLine(137, 338, 86, 323);
        outline.AddLine(86, 323, 35, 286);
        outline.AddBezier(35, 286, 32, 224, 34, 151, 36, 95);
        outline.AddLine(36, 95, 40, 31);
        outline.CloseFigure();

        // Supersample just the alpha channel. Original RGB/branding is never repainted.
        using (var largeMask = new Bitmap(865 * 4, 466 * 4, PixelFormat.Format32bppArgb))
        using (var mask = new Bitmap(865, 466, PixelFormat.Format32bppArgb)) {
          using (var g = Graphics.FromImage(largeMask)) {
            g.Clear(Color.Black);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.ScaleTransform(4, 4);
            g.FillPath(Brushes.White, outline);
          }
          using (var g = Graphics.FromImage(mask)) {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.DrawImage(largeMask, new Rectangle(0, 0, 865, 466));
          }
          var crop = new Rectangle(29, 7, 817, 459);
          using (var result = new Bitmap(crop.Width, crop.Height, PixelFormat.Format32bppArgb)) {
            for (int y = 0; y < crop.Height; y++) {
              for (int x = 0; x < crop.Width; x++) {
                Color original = source.GetPixel(x + crop.X, y + crop.Y);
                int alpha = mask.GetPixel(x + crop.X, y + crop.Y).R;
                result.SetPixel(x, y, alpha == 0 ? Color.FromArgb(0, 0, 0, 0) : Color.FromArgb(alpha, original.R, original.G, original.B));
              }
            }
            result.Save(Path.Combine(folder, "samanvi-bus.png"), ImageFormat.Png);
            using (var review = new Bitmap(850, 1000))
            using (var g = Graphics.FromImage(review)) {
              g.Clear(ColorTranslator.FromHtml("#111315"));
              using (var light = new SolidBrush(ColorTranslator.FromHtml("#F5F5F7")))
                g.FillRectangle(light, 0, 500, 850, 500);
              g.DrawImageUnscaled(result, 16, 20);
              g.DrawImageUnscaled(result, 16, 520);
              review.Save(Path.Combine(root, "docs", "intro-cutout-review.png"), ImageFormat.Png);
            }
          }
        }
      }
    }
  }
}
'@
[IntroBusCutout]::Generate((Split-Path $PSScriptRoot -Parent))
# pngjs is already installed by Expo's image tooling. Adaptive PNG filters are
# lossless: this reduces download size without recoloring the actual bus.
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  node -e "const fs=require('node:fs'); const {PNG}=require('pngjs'); for(const file of ['assets/intro/samanvi-bus.png','docs/intro-cutout-review.png']) { const image=PNG.sync.read(fs.readFileSync(file)); fs.writeFileSync(file, PNG.sync.write(image,{filterType:-1,deflateLevel:9})); }"
  if ($LASTEXITCODE -ne 0) { throw 'Lossless PNG optimization failed. Restore npm dependencies and retry.' }
} finally { Pop-Location }
Get-Item (Join-Path $PSScriptRoot '../assets/intro/samanvi-bus.png') | Select-Object Name, Length
