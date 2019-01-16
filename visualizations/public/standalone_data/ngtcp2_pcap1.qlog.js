var ngtcp2_pcap1 = {
    "qlog_version": "0.1",
    "description": "Single trace of a normal connection from default ngtcp2, minimal",
    "connections": [
        {
            "quic_version": "0xff00000f",
            "vantagepoint": "NETWORK",
            "connectionid": "0e8ac117cd49382ca96244849f52c15e42",
            "starttime": 1545039830.418219,
            "fields": [
                "time",
                "category",
                "type",
                "trigger",
                "data"
            ],
            "events": [
                [
                    0,
                    "CONNECTIVITY",
                    "NEW CONNECTION",
                    "LINE",
                    {
                        "ip_version": "4",
                        "srcip": "127.0.0.1",
                        "dstip": "127.0.0.1",
                        "srcport": "50506",
                        "dstport": "4433"
                    }
                ],
                [
                    0,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Initial",
                            "version": "0xff00000f",
                            "scid": "0e8ac117cd49382ca96244849f52c15e42",
                            "dcid": "409fb12c4c35d5bd03bf5876588f326413c9",
                            "scil": "14",
                            "dcil": "15",
                            "payload_length": "1208",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "PADDING",
                                "frame_type.padding_length": "888"
                            }
                        ]
                    }
                ],
                [
                    3,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "scil": "15",
                            "dcil": "14",
                            "payload_length": "1016",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "0",
                                "frame_type.crypto.length": "995",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": {
                                    "tls.handshake.type": "11",
                                    "tls.handshake.length": "877",
                                    "tls.handshake.certificate_request_context_length": "0",
                                    "tls.handshake.certificates_length": "873",
                                    "tls.handshake.certificates": {
                                        "tls.handshake.certificate_length": "868",
                                        "tls.handshake.certificate": "30:82:03:60:30:82:02:48:a0:03:02:01:02:02:09:00:e7:52:39:c2:ce:de:37:47:30:0d:06:09:2a:86:48:86:f7:0d:01:01:0b:05:00:30:45:31:0b:30:09:06:03:55:04:06:13:02:41:55:31:13:30:11:06:03:55:04:08:0c:0a:53:6f:6d:65:2d:53:74:61:74:65:31:21:30:1f:06:03:55:04:0a:0c:18:49:6e:74:65:72:6e:65:74:20:57:69:64:67:69:74:73:20:50:74:79:20:4c:74:64:30:1e:17:0d:31:38:31:32:31:32:31:35:35:39:30:33:5a:17:0d:31:39:31:32:31:32:31:35:35:39:30:33:5a:30:45:31:0b:30:09:06:03:55:04:06:13:02:41:55:31:13:30:11:06:03:55:04:08:0c:0a:53:6f:6d:65:2d:53:74:61:74:65:31:21:30:1f:06:03:55:04:0a:0c:18:49:6e:74:65:72:6e:65:74:20:57:69:64:67:69:74:73:20:50:74:79:20:4c:74:64:30:82:01:22:30:0d:06:09:2a:86:48:86:f7:0d:01:01:01:05:00:03:82:01:0f:00:30:82:01:0a:02:82:01:01:00:a9:20:e4:e1:90:c5:5b:31:6d:e1:ba:8a:56:27:d2:5c:8d:a3:69:86:15:fc:a3:1e:60:a8:4a:ea:47:5c:90:25:43:06:a5:0a:1f:36:7c:40:1a:5e:f8:e8:72:6a:ed:a6:38:28:eb:f6:00:4f:04:c0:54:16:ea:e5:fb:f8:06:a6:b3:e7:3e:35:7b:e7:a9:d2:fa:4d:f2:d8:03:c2:8c:c1:cb:d7:e7:6d:a1:3d:4c:59:d1:4d:c1:e2:b0:0f:53:d4:8e:eb:bd:81:26:01:8c:54:a7:f0:4e:c4:90:e9:9f:31:a5:63:59:9d:b0:19:71:0e:94:dd:0b:2a:45:dc:19:43:90:26:b3:ca:29:53:d8:a9:15:e8:0b:e4:a2:13:04:a6:f4:47:69:17:db:7e:47:0e:53:2f:12:94:24:ea:d9:81:78:6e:cf:bd:58:58:6c:eb:93:da:ba:10:45:fd:dc:b8:67:fc:84:50:a7:db:32:05:56:4f:71:af:44:59:3a:71:1d:de:69:75:a4:c4:65:3e:77:20:50:cb:df:6d:80:36:d3:75:a9:32:01:d7:76:0b:1e:8f:c0:5e:e6:f7:af:b9:78:34:1e:f3:00:a0:aa:6f:e6:ce:6a:8f:34:58:29:ac:60:28:4a:fd:05:cd:4e:3d:bc:5c:ce:a3:d7:43:04:99:02:03:01:00:01:a3:53:30:51:30:1d:06:03:55:1d:0e:04:16:04:14:54:fd:92:9e:9a:22:10:ce:af:f6:80:9d:3e:e8:e7:91:5c:e8:df:3e:30:1f:06:03:55:1d:23:04:18:30:16:80:14:54:fd:92:9e:9a:22:10:ce:af:f6:80:9d:3e:e8:e7:91:5c:e8:df:3e:30:0f:06:03:55:1d:13:01:01:ff:04:05:30:03:01:01:ff:30:0d:06:09:2a:86:48:86:f7:0d:01:01:0b:05:00:03:82:01:01:00:8d:e1:74:49:61:66:b5:30:c3:00:4a:7b:e3:aa:73:6a:5d:3c:c2:48:c5:5c:69:1c:dc:55:6c:16:55:f4:96:5e:ee:1c:dc:f1:b1:21:07:69:71:2d:dd:44:96:67:13:aa:cc:7a:32:6f:f9:44:77:a7:bd:32:c5:c4:30:06:1d:15:60:df:66:22:25:ff:cf:b4:66:02:ad:70:c2:6e:c9:63:e8:b7:c5:ed:3e:2e:d8:9b:a4:02:73:8f:46:34:33:74:30:94:0e:45:a6:75:63:8c:b1:88:f0:bd:c9:5c:91:79:ac:29:ec:89:c3:3a:48:f4:53:58:6f:10:f2:fd:f9:c4:e0:5e:87:a4:c8:ac:fb:48:54:eb:6f:9d:6f:f7:e9:cf:4c:e4:97:75:65:14:0e:64:f7:01:a5:6b:69:b6:24:ea:c8:88:5f:1b:c5:de:fb:1f:a2:5b:2a:05:76:ea:a9:2a:65:9b:4f:05:0d:bd:b2:c3:d4:aa:34:33:a9:bf:86:5b:2e:29:4a:e7:08:43:1a:53:1d:c0:8a:0d:5e:45:16:0c:f7:76:8d:81:b0:0d:15:ab:87:c8:7f:37:ec:d0:47:02:7c:2d:c1:5c:ce:fe:e0:34:0d:4e:3d:f8:c9:bd:75:be:33:82:c0:fc:f6:90:46:b4:bb:f9:d9:28:13:cd:6d:d7",
                                        "tls.handshake.certificate_tree": {
                                            "x509af.signedCertificate_element": {
                                                "x509af.version": "2",
                                                "x509af.serialNumber": "16668448679708735303",
                                                "x509af.signature_element": {
                                                    "x509af.algorithm.id": "1.2.840.113549.1.1.11"
                                                },
                                                "x509af.issuer": "0",
                                                "x509af.issuer_tree": {
                                                    "x509if.rdnSequence": "3",
                                                    "x509if.rdnSequence_tree": {
                                                        "x509if.RDNSequence_item": "1",
                                                        "x509if.RDNSequence_item_tree": {
                                                            "x509if.RelativeDistinguishedName_item_element": {
                                                                "x509if.id": "2.5.4.10",
                                                                "x509sat.DirectoryString": "4",
                                                                "x509sat.DirectoryString_tree": {
                                                                    "x509sat.uTF8String": "Internet Widgits Pty Ltd"
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                "x509af.validity_element": {
                                                    "x509af.notBefore": "0",
                                                    "x509af.notBefore_tree": {
                                                        "x509af.utcTime": "18-12-12 15:59:03 (UTC)"
                                                    },
                                                    "x509af.notAfter": "0",
                                                    "x509af.notAfter_tree": {
                                                        "x509af.utcTime": "19-12-12 15:59:03 (UTC)"
                                                    }
                                                },
                                                "x509af.subject": "0",
                                                "x509af.subject_tree": {
                                                    "x509af.rdnSequence": "3",
                                                    "x509af.rdnSequence_tree": {
                                                        "x509if.RDNSequence_item": "1",
                                                        "x509if.RDNSequence_item_tree": {
                                                            "x509if.RelativeDistinguishedName_item_element": {
                                                                "x509if.id": "2.5.4.10",
                                                                "x509sat.DirectoryString": "4",
                                                                "x509sat.DirectoryString_tree": {
                                                                    "x509sat.uTF8String": "Internet Widgits Pty Ltd"
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                "x509af.subjectPublicKeyInfo_element": {
                                                    "x509af.algorithm_element": {
                                                        "x509af.algorithm.id": "1.2.840.113549.1.1.1"
                                                    },
                                                    "x509af.subjectPublicKey": "30:82:01:0a:02:82:01:01:00:a9:20:e4:e1:90:c5:5b:31:6d:e1:ba:8a:56:27:d2:5c:8d:a3:69:86:15:fc:a3:1e:60:a8:4a:ea:47:5c:90:25:43:06:a5:0a:1f:36:7c:40:1a:5e:f8:e8:72:6a:ed:a6:38:28:eb:f6:00:4f:04:c0:54:16:ea:e5:fb:f8:06:a6:b3:e7:3e:35:7b:e7:a9:d2:fa:4d:f2:d8:03:c2:8c:c1:cb:d7:e7:6d:a1:3d:4c:59:d1:4d:c1:e2:b0:0f:53:d4:8e:eb:bd:81:26:01:8c:54:a7:f0:4e:c4:90:e9:9f:31:a5:63:59:9d:b0:19:71:0e:94:dd:0b:2a:45:dc:19:43:90:26:b3:ca:29:53:d8:a9:15:e8:0b:e4:a2:13:04:a6:f4:47:69:17:db:7e:47:0e:53:2f:12:94:24:ea:d9:81:78:6e:cf:bd:58:58:6c:eb:93:da:ba:10:45:fd:dc:b8:67:fc:84:50:a7:db:32:05:56:4f:71:af:44:59:3a:71:1d:de:69:75:a4:c4:65:3e:77:20:50:cb:df:6d:80:36:d3:75:a9:32:01:d7:76:0b:1e:8f:c0:5e:e6:f7:af:b9:78:34:1e:f3:00:a0:aa:6f:e6:ce:6a:8f:34:58:29:ac:60:28:4a:fd:05:cd:4e:3d:bc:5c:ce:a3:d7:43:04:99:02:03:01:00:01",
                                                    "x509af.subjectPublicKey_tree": {
                                                        "pkcs1.modulus": "00:a9:20:e4:e1:90:c5:5b:31:6d:e1:ba:8a:56:27:d2:5c:8d:a3:69:86:15:fc:a3:1e:60:a8:4a:ea:47:5c:90:25:43:06:a5:0a:1f:36:7c:40:1a:5e:f8:e8:72:6a:ed:a6:38:28:eb:f6:00:4f:04:c0:54:16:ea:e5:fb:f8:06:a6:b3:e7:3e:35:7b:e7:a9:d2:fa:4d:f2:d8:03:c2:8c:c1:cb:d7:e7:6d:a1:3d:4c:59:d1:4d:c1:e2:b0:0f:53:d4:8e:eb:bd:81:26:01:8c:54:a7:f0:4e:c4:90:e9:9f:31:a5:63:59:9d:b0:19:71:0e:94:dd:0b:2a:45:dc:19:43:90:26:b3:ca:29:53:d8:a9:15:e8:0b:e4:a2:13:04:a6:f4:47:69:17:db:7e:47:0e:53:2f:12:94:24:ea:d9:81:78:6e:cf:bd:58:58:6c:eb:93:da:ba:10:45:fd:dc:b8:67:fc:84:50:a7:db:32:05:56:4f:71:af:44:59:3a:71:1d:de:69:75:a4:c4:65:3e:77:20:50:cb:df:6d:80:36:d3:75:a9:32:01:d7:76:0b:1e:8f:c0:5e:e6:f7:af:b9:78:34:1e:f3:00:a0:aa:6f:e6:ce:6a:8f:34:58:29:ac:60:28:4a:fd:05:cd:4e:3d:bc:5c:ce:a3:d7:43:04:99",
                                                        "pkcs1.publicExponent": "65537"
                                                    }
                                                },
                                                "x509af.extensions": "3",
                                                "x509af.extensions_tree": {
                                                    "x509af.Extension_element": {
                                                        "x509af.extension.id": "2.5.29.19",
                                                        "x509af.critical": "1",
                                                        "x509ce.BasicConstraintsSyntax_element": {
                                                            "x509ce.cA": "1"
                                                        }
                                                    }
                                                }
                                            },
                                            "x509af.algorithmIdentifier_element": {
                                                "x509af.algorithm.id": "1.2.840.113549.1.1.11"
                                            },
                                            "ber.bitstring.padding": "0",
                                            "x509af.encrypted": "8d:e1:74:49:61:66:b5:30:c3:00:4a:7b:e3:aa:73:6a:5d:3c:c2:48:c5:5c:69:1c:dc:55:6c:16:55:f4:96:5e:ee:1c:dc:f1:b1:21:07:69:71:2d:dd:44:96:67:13:aa:cc:7a:32:6f:f9:44:77:a7:bd:32:c5:c4:30:06:1d:15:60:df:66:22:25:ff:cf:b4:66:02:ad:70:c2:6e:c9:63:e8:b7:c5:ed:3e:2e:d8:9b:a4:02:73:8f:46:34:33:74:30:94:0e:45:a6:75:63:8c:b1:88:f0:bd:c9:5c:91:79:ac:29:ec:89:c3:3a:48:f4:53:58:6f:10:f2:fd:f9:c4:e0:5e:87:a4:c8:ac:fb:48:54:eb:6f:9d:6f:f7:e9:cf:4c:e4:97:75:65:14:0e:64:f7:01:a5:6b:69:b6:24:ea:c8:88:5f:1b:c5:de:fb:1f:a2:5b:2a:05:76:ea:a9:2a:65:9b:4f:05:0d:bd:b2:c3:d4:aa:34:33:a9:bf:86:5b:2e:29:4a:e7:08:43:1a:53:1d:c0:8a:0d:5e:45:16:0c:f7:76:8d:81:b0:0d:15:ab:87:c8:7f:37:ec:d0:47:02:7c:2d:c1:5c:ce:fe:e0:34:0d:4e:3d:f8:c9:bd:75:be:33:82:c0:fc:f6:90:46:b4:bb:f9:d9:28:13:cd:6d:d7"
                                        },
                                        "tls.handshake.extensions_length": "0"
                                    }
                                }
                            }
                        ]
                    }
                ],
                [
                    3,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "scil": "15",
                            "dcil": "14",
                            "payload_length": "321",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "995",
                                "frame_type.crypto.length": "299",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": ""
                            }
                        ]
                    }
                ],
                [
                    23,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Initial",
                            "version": "0xff00000f",
                            "scid": "0e8ac117cd49382ca96244849f52c15e42",
                            "dcid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "scil": "14",
                            "dcil": "15",
                            "payload_length": "1208",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "PADDING",
                                "frame_type.padding_length": "1186"
                            }
                        ]
                    }
                ],
                [
                    29,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "0e8ac117cd49382ca96244849f52c15e42",
                            "dcid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "scil": "14",
                            "dcil": "15",
                            "payload_length": "77",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "1",
                                "frame_type.ack.ack_delay": "0",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "1"
                            }
                        ]
                    }
                ],
                [
                    29,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "scil": "15",
                            "dcil": "14",
                            "payload_length": "22",
                            "packet_number": "2"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "0",
                                "frame_type.ack.ack_delay": "0",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "0"
                            }
                        ]
                    }
                ],
                [
                    29,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "payload_length": "TODO",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "STREAM",
                                "frame_type_tree": {
                                    "quic.frame_type.stream.fin": "1",
                                    "quic.frame_type.stream.len": "1",
                                    "quic.frame_type.stream.off": "0"
                                },
                                "stream.stream_id": "3",
                                "stream.length": "12",
                                "stream_data": "48:65:6c:6c:6f:20:57:6f:72:6c:64:21"
                            }
                        ]
                    }
                ],
                [
                    31,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "ac2f47839bc824a9b181381aef78c69d691c",
                            "payload_length": "TODO",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "0",
                                "frame_type.ack.ack_delay": "0",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "0"
                            }
                        ]
                    }
                ],
                [
                    31,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "payload_length": "TODO",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "0",
                                "frame_type.ack.ack_delay": "0",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "0"
                            }
                        ]
                    }
                ],
                [
                    1993,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "0e8ac117cd49382ca96244849f52c15e42",
                            "payload_length": "TODO",
                            "packet_number": "2"
                        },
                        "frames": [
                            {
                                "frame_type": "CONNECTION_CLOSE",
                                "frame_type.cc.error_code": "0",
                                "frame_type.cc.frame_type": "0",
                                "frame_type.cc.reason_phrase.length": "0",
                                "frame_type.cc.reason_phrase": ""
                            }
                        ]
                    }
                ]
            ],
        },
    ],
        
};