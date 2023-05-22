# Researches
This file contains all the researches I've done on the game files.


Trailer Files
-------------
I suppose, for now, that these files are actually some trailer videos or something like that.
There's only 4 of these files inside the Big File, they all ends with `NTSC` and `PAL`.

These files can be found inside `01 Texture Bank/Video Library/Trailer BGE`,
so it seems possible that these files could be some video that can be set as textures inside of the game..

Note that `NTSC` data are not compressed, compared to `PAL`, this can be seen inside the
decompressed file size field, if the file size == the decompressed file size (diff of 2004), it uses `NTSC`.

The 2004 bytes are at the end, it's a padding of `0x00` bytes.

A `*.mtx` file seems to contain one or multiple tables that starts just after the header,
these tables are the same size between `NTSC` & `PAL`.
After that, a big padding containing only 0x00 separates the actual data from the table(s).

The data seems to be represented as 16 bytes long (starting after the header).

The table values seems to generally start with `0x0C`, I suppose that the first byte could be reserved
to indicate the type of block, but note that it's not always the case.
A clue is that the second byte is generally `0x00`.

Here's a table containing what I found out about the file header (for `MO_NTSC.mtx`):

| Offset | `NTSC`      | Value      | Description                              |
|--------|-------------|------------|------------------------------------------|
| 0      | 6D 74 78 20 | ---------- | Magic ("mtx ")                           |
| 4      | 01 10 00 00 | 4097       | Possibly the format/version              |
| 8      | 28 10 FF 01 | 33,493,032 | File size (-2004)                        |
| 12     | 00 80 1C 00 | 1,867,776  | The size of the padding & one data block |
| 16     | 0B D5 BF 01 | 29,349,131 | ? (always < file size)                   |
| 20     | 00 C8 00 00 | 51,200     | Size of a table                          |
| 24     | 02 00 00 00 | 2          | ?                                        |
| 28     | 00 80 0C 00 | 819,200    | ?                                        |
| 32     | 00 7D 00 00 | 32,000     | Certainly a sample rate / data rate      |
| 36     | 00 00 80 3F | ---------- | Last value of the header                 |

Here's the table of each block (for `MO_NTSC.mtx`):

| Offset     | Size       | Description                              |
|------------|------------|------------------------------------------|
| 0          | 40         | File header                              |
| 40         | 51,200     | Table A & data                           |
| 51,240     | 51,200     | Table B & data                           |
| 102,440    | 1,867,776  | Padding                                  |
| 1,970,216  | 25,612,288 | Main data ?                              |
| 27,582,504 | 51,200     | Table C                                  |
| 27,633,704 | 51,200     | Table D                                  |
| 27,684,904 | 1,867,776  | A set of data                            |
| 29,552,680 | 51,200     | Table E (0x0C & empty)                   |
| 29,603,880 | 51,200     | Table F (0x0C & empty)                   |
| 29,655,080 | 1,867,776  | A set of data                            |
| 31,522,856 | 51,200     | Table G (0x0C & empty)                   |
| 31,574,056 | 51,200     | Table H (0x0C & empty)                   |
| 31,625,256 | 1,867,776  | A set of data                            |
| 33,493,032 | 2,004      | Padding                                  |

About the last data set, it's a bit .. complicated, it is actually not 1,867,776 bytes long
but 1,332,496 bytes long, with 537,284 `0x00` bytes, so 1,869,780 bytes long in total,
when 2004 is removed from this result (value obtained when I compare the size of the file with the size
inside the header), we also obtain 1,867,776 bytes long which corresponds to the size of one block.