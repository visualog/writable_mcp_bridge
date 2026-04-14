# Detail API Fallback

Detail APIs may return `metadata_fallback` when the plugin-native detail command is unavailable or Figma API restrictions prevent a full read.

## Still Useful

Fallback can still expose:

- layout mode
- item spacing
- padding
- variant properties
- component properties
- component property definitions when derivable

## Not Equivalent To Full Detail

Fallback is not proof that the detail command fully succeeded. Check:

- `result.source`
- `result.fallback.used`
- `result.fallback.reason`

## Next Step

If fallback has enough structure, continue implementation and record the limitation. If it lacks the needed fields, inspect a more specific node or page.
