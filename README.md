# enuf
The quicker, easier way to **e**lectronically  **nu**mber **f**iles. Because anyone who's ever numbered files by hand has had **enuf** of it. Dedicated to all the bibling lawyers who have done this for generations...

## Installation
From the command line:
```
$ npm i -g enuf 
```

Or, on Windows, you can [download the 64-bit executable by clicking this link](./enuf.exe). Make sure you save it in a folder in your [path](https://www.computerhope.com/issues/ch000549.htm) (on most Windows 10 installations, saving it in the folder %USERPROFILE%\AppData\Local\Microsoft\WindowsApps will work).

## Initialization
Make sure to run `enuf init` on any directory you will be importing files from or exporting files to before using enuf to renumber these files. `enuf init` will remove zero padding from numbered filenames (`'001.pdf' --> '1.pdf'`), which can cause errors. Once you are finished numbering your files, you can add the zero padding back in by running `enuf length <n>`, which will ensure all file numbers are padding with zeros until to make them at least `n` digits long (`enuf length 3` results in the following renaming: `'1.pdf' --> '001.pdf'; '10.pdf --> '010.pdf'; '100.pdf --> 100.pdf`).

## Usage
From the command line:
```
$ enuf --help

