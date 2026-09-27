import {
  DASH_1_INDEX,
  DASH_2_INDEX,
  DASH_3_INDEX,
  ID_LENGTH,
} from '@cmn/constants/segments';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface IdLayout {
  readonly segments: readonly number[];
  readonly classes: Readonly<Uint8Array>;
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// ---- Expected layout
// Every position needs an alphabet character, except the three dash spots.
// Values are CHAR_CLASS entries: 1 for a character, 2 for the dash.
const LAYOUT = new Uint8Array(ID_LENGTH).fill(1);
LAYOUT[DASH_1_INDEX] = 2;
LAYOUT[DASH_2_INDEX] = 2;
LAYOUT[DASH_3_INDEX] = 2;

const layoutsByLength: (IdLayout | undefined)[] = [];
const layoutsByTail: IdLayout[] = [];
{
  // Mono has the largest possible random tail: ceil(1024 / 5) = 205.
  // The formats share shape validation because their provenance is unknowable.
  const MAX_TAIL_CHARS = Math.ceil(1024 / 5);

  // Omitted entropy retains the fast default format. Explicit requests use
  // the fewest trailing segments, so ten tail characters fit in one segment.
  layoutsByLength[ID_LENGTH] = {
    segments: [9, 6, 5, 5],
    classes: LAYOUT,
  };

  const segments = [9, 6, 5];
  let tailChars = 5;
  let nextSegment = 2;

  while (tailChars <= MAX_TAIL_CHARS) {
    const length = 15 + tailChars + segments.length - 1;
    const classes = new Uint8Array(length).fill(1);
    let offset = segments[0];
    for (let i = 1; i < segments.length; i++) {
      classes[offset] = 2;
      offset += 1 + segments[i];
    }
    const layout = { segments: segments.slice(), classes };
    layoutsByLength[length] = layout;
    layoutsByTail[tailChars] = layout;

    const last = segments.length - 1;
    if (segments[last] === 10 && (last === 2 || segments[last - 1] === 10)) {
      // Add only one character overall: redistribute four from the previous
      // full segment to start the new segment at five (10-10 -> 10-6-5).
      // The first split is 10 -> 6-5. Resume with the shorter member so
      // the newest pair stays balanced.
      segments[last] -= 4;
      segments.push(5);
      nextSegment = last + 1;
    } else if (last === 2) {
      segments[last]++;
    } else {
      // Alternate the newest pair, skipping either member already at ten.
      if (segments[nextSegment] === 10) {
        nextSegment = nextSegment === last ? last - 1 : last;
      }
      segments[nextSegment]++;
      nextSegment = nextSegment === last ? last - 1 : last;
    }
    tailChars++;
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export const LAYOUTS_BY_TAIL: readonly IdLayout[] = layoutsByTail;
export const LAYOUTS_BY_LENGTH: readonly (IdLayout | undefined)[] =
  layoutsByLength;
