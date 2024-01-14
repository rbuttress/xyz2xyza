const fs = require( 'fs' );
const chokidar = require( 'chokidar' );
const chalk = require( 'chalk' );

const inputDir = './xyz';  // Relative path to the input directory
const outputDir = './xyza'; // Relative path to the output directory


const threshold = require( './threshold.json' );
console.log( threshold );
const radianThreshold = ( threshold.radianThreshold * Math.PI ) / 180;
console.log( radianThreshold );




let safeZ;  // Variable to store the first Z value
let workZ;  // Variable to store the next Z value

function findFirstAndNextZValues( lines ) {
  let foundFirstZ = false;

  for ( const line of lines ) {
    const zMatch = line.match( /Z(\-?\d+(\.\d+)?)/ );
    if ( zMatch ) {
      if ( !foundFirstZ ) {
        safeZ = parseFloat( zMatch[1] );
        foundFirstZ = true;
      } else {
        workZ = parseFloat( zMatch[1] );
        break;
      }
    }
  }
}




let lastAbsoluteAngle = 0;  // Initialize last absolute angle
let appendedZAA = false;

function processGCodeLine( line, index, lines ) {


  // Skip lines that don't start with G or M
  if ( !/^([GM])/i.test( line.trim() ) ) {
    return null;  // Skip the line
  }

  // Skip empty or whitespace-only lines
  if ( !line.trim() ) {
    return null;
  }

  // Call this function before processing the file
  findFirstAndNextZValues( lines );

  // Extract x and y values from the current line
  const x1Match = line.match( /X(\-?\d+(\.\d+)?)/ );
  const y1Match = line.match( /Y(\-?\d+(\.\d+)?)/ );

  if ( x1Match && y1Match ) {
    const x1 = parseFloat( x1Match[1] );
    const y1 = parseFloat( y1Match[1] );

    // Find the next line with X or Y commands
    const nextLine = lines.slice( index + 1 ).find( nextLine => /([XY]\-?\d+(\.\d+)?)/.test( nextLine ) );

    if ( nextLine ) {
      // Extract x and y values from the next line
      const x2Match = nextLine.match( /X(\-?\d+(\.\d+)?)/ );
      const y2Match = nextLine.match( /Y(\-?\d+(\.\d+)?)/ );

      // Check if x and y of current line match x and y of next line
      if ( x1Match[1] === x2Match[1] && y1Match[1] === y2Match[1] ) {
        return null; // Skip the line
      }
      // Calculate the angle between the current line and the next line
      const deltaX = x2Match ? parseFloat( x2Match[1] ) - x1 : 0;
      const deltaY = y2Match ? parseFloat( y2Match[1] ) - y1 : 0;

      // Calculate the new angle in radians from the starting point
      const currentAngle = Math.atan2( deltaY, deltaX );

      // Adjust the current angle to minimize rotation
      const adjustedAngle = adjustAngle( currentAngle );

      // Declare angleDifference and degreeDifference outside the if
      let angleDifference = Math.abs( adjustedAngle - lastAbsoluteAngle );
      let degreeDifference = ( angleDifference * 180 ) / Math.PI;

      // Determine if the angle is obtuse or acute
      const accute = angleDifference <= radianThreshold;

      // Determine the parallel case
      const RR = /^G00/i.test( line.trim() ) && /^G00/i.test( nextLine.trim() );
      const RL = /^G00/i.test( line.trim() ) && /^G01/i.test( nextLine.trim() );
      const LR = /^G01/i.test( line.trim() ) && /^G00/i.test( nextLine.trim() );
      const LL = /^G01/i.test( line.trim() ) && /^G01/i.test( nextLine.trim() );

      // Check if X and Y values match between current and next line
      const xMatch = x1Match[1] === parseFloat( x2Match[1] ).toFixed( 4 );
      const yMatch = y1Match[1] === parseFloat( y2Match[1] ).toFixed( 4 );

      // Add a case to append a specific line if X and Y values match
      if ( xMatch && yMatch ) {
        line += ` YourSpecificLineHere`;  // Replace YourSpecificLineHere with the line you want to append
      } else {

        if ( accute ) {
          // Case when the angle difference is within the threshold
          if ( RR || RL ) {
            line += ` 
G01 A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}`;
          } else if ( LR ) {
            // Logic to append to Z command in the next line
            lines[index + 1] += ` 
G01 A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}`;
          } else if ( LL ) {
            line += ` 
G01 A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}`;
          }
        } else if ( !accute ) {
          // Case when the angle difference exceeds the threshold
          if ( RR || RL ) {
            line += ` A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}`;
          } else if ( LR ) {
            // Adjust the logic for Z command in the next line
            line += ` 
G01 Z${safeZ}
G00 A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}`;
          } else if ( LL ) {
            // Adjust the logic for Z command in the next line
            line += `
G01 Z${safeZ}
G00 A${adjustedAngle.toFixed( 4 )} ; ${degreeDifference.toFixed( 4 )}
G01 Z${workZ}`;
          }
        }

        const lastIndex = lines.reduceRight( ( acc, currentLine, currentIndex ) => {
          return /^G00/i.test( currentLine.trim() ) && acc === -1 ? currentIndex : acc;
        }, -1 );

        if ( lastIndex !== -1 && !appendedZAA ) {
          lines[lastIndex] += ` Z0 A0`;
          appendedZAA = true; // Set the flag to true after appending
        }

        // Update the last absolute angle for the next iteration
        lastAbsoluteAngle = adjustedAngle;
      }
    }
  }




  return line;
}









// Function to adjust the angle to minimize rotation in relation to the organic output of atan2 which gives the closest angle from 0 between +π or -π in radians, which inconviently may be greater than π away from the previous angle 

function adjustAngle( currentAngle ) {
  // Calculate the difference between the current angle and the last absolute angle
  const angleDifference = currentAngle - lastAbsoluteAngle;

  // Normalize the angle to be within the range of -π to π
  const normalizedDifference = ( angleDifference + Math.PI ) % ( 2 * Math.PI ) - Math.PI;

  // Adjust the current angle to minimize rotation
  const adjustedAngle = lastAbsoluteAngle + normalizedDifference;

  return adjustedAngle;
}










// Function to colorize G-code based on regex
function colorizeGCode( line ) {
  // Colorize G commands

  line = line.replace( /\b(G00)\b/g, chalk.hex( '#0000FF' )( '$1' ) );   // G0 in blue
  line = line.replace( /\b(G21)\b/g, chalk.hex( '#00F0FF' )( '$1' ) );   // G21 in blue
  line = line.replace( /\b(G01)\b/g, chalk.hex( '#FF0000' )( '$1' ) );   // G01 in red
  line = line.replace( /\b(G02)\b/g, chalk.hex( '#FFA500' )( '$1' ) );   // G02 in orange
  line = line.replace( /\b(G03)\b/g, chalk.hex( '#FFFF00' )( '$1' ) );   // G03 in yellow

  // Colorize M commands
  line = line.replace( /\b(M\d+)\b/g, chalk.hex( '#00FFFF' )( '$1' ) ); // M commands in cyan

  // Colorize X, Y, Z, A, I, J, K commands
  line = line.replace( /([XYZAIJKF]\-?\d+(\.\d+)?)/g, ( match ) => {
    switch ( match[0] ) {
      case 'X':
        return chalk.hex( '#008000' )( match );         // X in green
      case 'Y':
        return chalk.hex( '#FF00FF' )( match );         // Y in magenta
      case 'Z':
        return chalk.hex( '#FFFF80' )( match );         // Z in bright yellow
      case 'A':
        return chalk.hex( '#00FFFF' )( match );         // A in bright cyan
      case 'F':
        return chalk.hex( '#FF4040' )( match );         // I in bright red
      case 'I':
        return chalk.hex( '#FF4040' )( match );         // I in bright red
      case 'J':
        return chalk.hex( '#0000FF' )( match );         // J in bright blue
      case 'K':
        return chalk.hex( '#FF00FF' )( match );         // K in bright magenta
      default:
        return match;
    }


  } );

  return line;
}










function processGCodeFile( filePath ) {
  try {
    const originalContent = fs.readFileSync( filePath, 'utf-8' );
    const lines = originalContent.split( '\n' );

    // Remove blank lines and lines with only whitespace characters
    const filteredLines = lines.filter( line => line.trim() !== '' );

    const modifiedLines = filteredLines.map( processGCodeLine );
    const modifiedContent = modifiedLines.join( '\n' );

    const colorizedLine = colorizeGCode( modifiedContent );
    console.log( colorizedLine );

    // Save the modified content to the output directory with the same file name
    const outputFilePath = `${outputDir}/${filePath.split( '/' ).pop()}`;
    fs.writeFileSync( outputFilePath, modifiedContent );

    // Delete the original file
    // fs.unlinkSync(filePath);
    console.log( `Processed and modified: ${filePath}` );
  } catch ( error ) {
    console.error( `Error processing file: ${error}` );
  }

  lastAbsoluteAngle = 0;  // Renitialize flags
  appendedZAA = false;
}










// Watch for changes in the input directory
const watcher = chokidar.watch( inputDir, { ignored: /\.txt$/, persistent: true } ) // Ignore .txt files, adjust as needed
  .on( 'add', ( filePath ) => {
    // Process the new G-code file
    if ( filePath.endsWith( '.nc' ) ) {
      processGCodeFile( filePath );
    }
  } )
  .on( 'ready', () => {
    const files = fs.readdirSync( inputDir ).filter( file => file.endsWith( '.nc' ) );
    if ( files.length === 0 ) {
      console.log( 'No G-code files found in the input directory.' );
    } else {
      console.log( `Initial scan found ${files.length} G-code file(s).` );
    }
    console.log( 'Watching for changes in the input directory...' );
  } )
  .on( 'error', ( error ) => {
    console.error( `Error watching directory: ${error}` );
  } );
