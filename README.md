# qvis

A set of QUIC and HTTP/3 visualization tools. 

The tools are mainly expected to be used with the [qlog logging format](https://github.com/quicwg/qlog/) as input,
but we also have (partial) support for uploading pcap files,
as well as Google Chrome netlog files.

A full-featured, hosted version with example qlog files can be found at https://qvis.quictools.info/.
Instructions and docker files for setting up your own copy can be found at https://github.com/quiclog/qvis-server.


## older versions

This is the new version of the qvis visualization suite.
The old version can be found at https://github.com/rmarx/quicvis
The results from the paper ["Towards QUIC Debuggability"](https://quic.edm.uhasselt.be/) were obtained using the old version.
The old version is no longer maintained and is not compatible with the new qlog formats (draft-01+). 

Results from [newer papers](https://qlog.edm.uhasselt.be/) were all obtained using (variations on) tools in the current qvis toolsuite.
