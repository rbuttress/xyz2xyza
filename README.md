# xyz2xyza

Computes A axis adjustments in radians and appends A0.00 commands  for tangent knife operations to standard 3 axis gcode. No warranty or liability.  Do not use without conducting complete Gcode review

## Install

```sh
$ cd xyz2xyza
$ npm install
```

```sh
$ node index.js
```

## Usage


1. Impliments directory monitoring for .nc files. After starting set the output directory of you favorite Gcode generator to xyz2xyza/xyz/. 
2. The modified files should automatically get added to /xyz2xyza/xyza/
3. Clearing Gcode comments headers and footers
4. Sorting G0 and G1 commands into categories based on the category of command which follow it
5. Computes absolute global A axis angle atan2(y2-y1/x2-x1) for current line based on the line which follows
6. threshold.json sets the threshold parameter (in degrees) which would prompt a raising and lowering of the knife, before and after the adjustment of the knife angle to avoid snapping it off in your work piece

## Contributing

Join me rosebuttress@gmail.com
<a href="https://full.directory">

PRs accepted.

## License

☭ Anti-copyright
Maintained by 🌹


