var quictracker_handshake_v6_quicker_20181219 = {
    "qlog_version": "0.1",
    "description": "Example trace from the quic-tracker tool",
    "connections": [
        {
            "quic_version": "0xff00000f",
            "qlog_version": "0.1",
            "vantagepoint": "NETWORK",
            "connectionid": "eca03c64cff7d334",
            "starttime": 1545242603.978787,
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
                        "ip_version": "6",
                        "srcip": "2607:5300:60:4b33:2::1",
                        "dstip": "2001:6a8:2100:2::98",
                        "srcport": "43905",
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
                            "scid": "eca03c64cff7d334",
                            "dcid": "c901f77788489c51",
                            "scil": "5",
                            "dcil": "5",
                            "payload_length": "1206",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "PADDING",
                                "frame_type.padding_length": "903"
                            }
                        ]
                    }
                ],
                [
                    119,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Initial",
                            "version": "0xff00000f",
                            "scid": "0911a29a91ea2da771",
                            "dcid": "eca03c64cff7d334",
                            "scil": "6",
                            "dcil": "5",
                            "payload_length": "176",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "0",
                                "frame_type.crypto.length": "155",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": {
                                    "tls.handshake.type": "2",
                                    "tls.handshake.length": "151",
                                    "tls.handshake.version": "0x00000303",
                                    "tls.handshake.random": "80:67:be:fc:26:4c:01:9f:5a:67:d8:78:be:8f:f6:17:50:6f:ee:d2:dd:c4:bc:08:98:f5:cf:9d:32:92:47:79",
                                    "tls.handshake.session_id_length": "32",
                                    "tls.handshake.session_id": "2f:a1:30:bc:91:7a:27:06:61:87:58:14:9d:21:57:9c:f3:ca:bf:4a:be:b4:c6:6d:f6:7d:37:cb:b8:09:03:4f",
                                    "tls.handshake.ciphersuite": "4866",
                                    "tls.handshake.comp_method": "0",
                                    "tls.handshake.extensions_length": "79",
                                    "Extension: supported_versions (len=2)": {
                                        "tls.handshake.extension.type": "43",
                                        "tls.handshake.extension.len": "2",
                                        "tls.handshake.extensions.supported_version": "0x00000304"
                                    },
                                    "Extension: key_share (len=69)": {
                                        "tls.handshake.extension.type": "51",
                                        "tls.handshake.extension.len": "69",
                                        "Key Share extension": {
                                            "Key Share Entry: Group: secp256r1, Key Exchange length: 65": {
                                                "tls.handshake.extensions_key_share_group": "23",
                                                "tls.handshake.extensions_key_share_key_exchange_length": "65",
                                                "tls.handshake.extensions_key_share_key_exchange": "04:a8:01:0c:4c:fe:ed:49:aa:0c:2c:11:f8:b6:74:44:ba:d6:7a:e5:9b:fd:51:58:3a:2c:25:89:a6:73:06:60:81:bb:a4:63:10:56:1b:11:27:c4:52:74:21:84:29:04:29:87:ba:3e:76:1e:e1:23:a3:e6:6b:50:8d:73:d8:57:ee"
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ],
                [
                    119,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Initial",
                            "version": "0xff00000f",
                            "scid": "0911a29a91ea2da771",
                            "dcid": "eca03c64cff7d334",
                            "scil": "6",
                            "dcil": "5",
                            "payload_length": "23",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "0",
                                "frame_type.ack.ack_delay": "3060",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "0"
                            }
                        ]
                    }
                ],
                [
                    120,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "0911a29a91ea2da771",
                            "dcid": "eca03c64cff7d334",
                            "scil": "6",
                            "dcil": "5",
                            "payload_length": "1221",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "0",
                                "frame_type.crypto.length": "1200",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": {
                                    "tls.handshake.type": "11",
                                    "tls.handshake.length": "1046",
                                    "tls.handshake.certificate_request_context_length": "0",
                                    "tls.handshake.certificates_length": "1042",
                                    "tls.handshake.certificates": {
                                        "tls.handshake.certificate_length": "1037",
                                        "tls.handshake.certificate": "30:82:04:09:30:82:02:f1:a0:03:02:01:02:02:09:00:8f:2a:53:d6:0c:43:5e:13:30:0d:06:09:2a:86:48:86:f7:0d:01:01:0b:05:00:30:81:9a:31:0b:30:09:06:03:55:04:06:13:02:42:45:31:10:30:0e:06:03:55:04:08:0c:07:4c:69:6d:62:75:72:67:31:13:30:11:06:03:55:04:07:0c:0a:44:69:65:70:65:6e:62:65:65:6b:31:1b:30:19:06:03:55:04:0a:0c:12:48:61:73:73:65:6c:74:20:55:6e:69:76:65:72:73:69:74:79:31:0c:30:0a:06:03:55:04:0b:0c:03:45:44:4d:31:12:30:10:06:03:55:04:03:0c:09:6c:6f:63:61:6c:68:6f:73:74:31:25:30:23:06:09:2a:86:48:86:f7:0d:01:09:01:16:16:72:6f:62:69:6e:2e:6d:61:72:78:40:75:68:61:73:73:65:6c:74:2e:62:65:30:1e:17:0d:31:38:30:32:32:38:31:30:32:35:35:33:5a:17:0d:31:39:30:32:32:38:31:30:32:35:35:33:5a:30:81:9a:31:0b:30:09:06:03:55:04:06:13:02:42:45:31:10:30:0e:06:03:55:04:08:0c:07:4c:69:6d:62:75:72:67:31:13:30:11:06:03:55:04:07:0c:0a:44:69:65:70:65:6e:62:65:65:6b:31:1b:30:19:06:03:55:04:0a:0c:12:48:61:73:73:65:6c:74:20:55:6e:69:76:65:72:73:69:74:79:31:0c:30:0a:06:03:55:04:0b:0c:03:45:44:4d:31:12:30:10:06:03:55:04:03:0c:09:6c:6f:63:61:6c:68:6f:73:74:31:25:30:23:06:09:2a:86:48:86:f7:0d:01:09:01:16:16:72:6f:62:69:6e:2e:6d:61:72:78:40:75:68:61:73:73:65:6c:74:2e:62:65:30:82:01:22:30:0d:06:09:2a:86:48:86:f7:0d:01:01:01:05:00:03:82:01:0f:00:30:82:01:0a:02:82:01:01:00:fa:59:72:bc:74:76:c0:ad:b9:75:d8:fe:7a:6d:17:32:4e:67:d7:cd:d2:7c:38:7b:63:1e:a7:97:59:92:b8:34:4b:ff:76:d5:b7:e0:45:54:88:89:06:66:26:cc:01:55:b4:26:8e:96:b0:4f:d2:e8:ba:40:9e:29:08:97:5a:72:ea:b5:25:d8:84:1c:aa:89:66:aa:26:48:6d:9b:ce:4c:1e:d7:af:7d:02:04:4b:15:91:9e:a0:41:02:4e:fb:96:9f:ec:c1:32:03:e6:a1:87:78:5a:2e:fc:8f:8d:8d:fc:c0:68:71:30:90:c1:1d:ea:43:d9:00:55:7c:9c:bc:29:a7:b1:d7:2d:e9:74:49:3b:dd:2b:1f:46:e4:21:8b:64:97:28:e3:62:8a:f5:04:5f:86:ce:34:0f:65:96:59:24:81:50:d9:61:6b:a9:72:47:4a:80:14:f0:e5:85:ca:f5:77:92:f9:7b:0e:50:b6:bb:b4:b7:e3:55:59:93:11:b2:57:4b:c8:a5:13:3c:da:65:6b:b2:dc:4e:57:8b:6f:7e:3a:ad:8c:f2:d0:ed:d0:bd:a2:bd:b7:63:c5:16:50:de:d9:1f:4c:53:4f:dd:d0:bd:8d:76:8f:13:92:46:2a:76:a0:e7:c4:4a:66:fb:74:d8:ad:63:4f:48:b6:20:26:c7:02:03:01:00:01:a3:50:30:4e:30:1d:06:03:55:1d:0e:04:16:04:14:cd:cd:70:ef:28:7e:6b:65:77:38:ca:e1:62:50:ac:26:de:2e:92:19:30:1f:06:03:55:1d:23:04:18:30:16:80:14:cd:cd:70:ef:28:7e:6b:65:77:38:ca:e1:62:50:ac:26:de:2e:92:19:30:0c:06:03:55:1d:13:04:05:30:03:01:01:ff:30:0d:06:09:2a:86:48:86:f7:0d:01:01:0b:05:00:03:82:01:01:00:b3:b7:e4:a0:89:58:43:0a:d8:0b:1d:e6:37:62:18:6b:93:cf:53:39:4f:1a:0f:b6:51:85:98:4f:da:c8:a0:aa:eb:d4:ac:a1:70:43:ac:2d:56:80:77:36:78:d1:e8:ee:36:94:cc:87:b0:6b:66:64:9b:3c:24:eb:80:98:f6:9d:16:c6:12:4d:ab:0e:f9:ae:83:39:17:6e:90:24:6d:ea:b0:14:c8:8d:51:ba:fe:fb:e3:51:45:18:5f:df:85:81:d6:08:fc:31:f7:33:ad:d7:8e:81:b6:60:3b:09:e1:ab:28:09:db:4a:78:26:18:e9:50:c2:33:54:5c:39:c4:83:e8:32:7f:6d:a4:6a:0d:73:b1:84:64:85:7a:cb:3b:86:ac:fd:e8:0c:25:72:41:e0:a7:33:44:15:fe:4d:93:70:1f:9d:47:0b:86:da:e8:87:c7:96:d3:53:46:71:50:05:4d:62:58:b8:11:cf:50:70:6e:bd:49:c7:7b:e6:56:60:d5:82:7c:85:7d:b9:8d:7e:3e:b9:5f:9a:25:e7:3f:b5:73:fe:8a:54:70:b4:c2:d7:53:e3:41:a2:d0:27:35:8f:94:03:a4:d4:63:4a:f4:44:15:40:19:e1:8a:ad:a7:24:1f:a8:e2:41:d9:d0:d4:22:37:0c:e2:7d:c7:13:cd:0c",
                                        "tls.handshake.certificate_tree": {
                                            "x509af.signedCertificate_element": {
                                                "x509af.version": "2",
                                                "x509af.serialNumber": "10316150075239390739",
                                                "x509af.signature_element": {
                                                    "x509af.algorithm.id": "1.2.840.113549.1.1.11"
                                                },
                                                "x509af.issuer": "0",
                                                "x509af.issuer_tree": {
                                                    "x509if.rdnSequence": "7",
                                                    "x509if.rdnSequence_tree": {
                                                        "x509if.RDNSequence_item": "1",
                                                        "x509if.RDNSequence_item_tree": {
                                                            "x509if.RelativeDistinguishedName_item_element": {
                                                                "x509if.id": "1.2.840.113549.1.9.1",
                                                                "x509sat.IA5String": "robin.marx@uhasselt.be"
                                                            }
                                                        }
                                                    }
                                                },
                                                "x509af.validity_element": {
                                                    "x509af.notBefore": "0",
                                                    "x509af.notBefore_tree": {
                                                        "x509af.utcTime": "18-02-28 10:25:53 (UTC)"
                                                    },
                                                    "x509af.notAfter": "0",
                                                    "x509af.notAfter_tree": {
                                                        "x509af.utcTime": "19-02-28 10:25:53 (UTC)"
                                                    }
                                                },
                                                "x509af.subject": "0",
                                                "x509af.subject_tree": {
                                                    "x509af.rdnSequence": "7",
                                                    "x509af.rdnSequence_tree": {
                                                        "x509if.RDNSequence_item": "1",
                                                        "x509if.RDNSequence_item_tree": {
                                                            "x509if.RelativeDistinguishedName_item_element": {
                                                                "x509if.id": "1.2.840.113549.1.9.1",
                                                                "x509sat.IA5String": "robin.marx@uhasselt.be"
                                                            }
                                                        }
                                                    }
                                                },
                                                "x509af.subjectPublicKeyInfo_element": {
                                                    "x509af.algorithm_element": {
                                                        "x509af.algorithm.id": "1.2.840.113549.1.1.1"
                                                    },
                                                    "x509af.subjectPublicKey": "30:82:01:0a:02:82:01:01:00:fa:59:72:bc:74:76:c0:ad:b9:75:d8:fe:7a:6d:17:32:4e:67:d7:cd:d2:7c:38:7b:63:1e:a7:97:59:92:b8:34:4b:ff:76:d5:b7:e0:45:54:88:89:06:66:26:cc:01:55:b4:26:8e:96:b0:4f:d2:e8:ba:40:9e:29:08:97:5a:72:ea:b5:25:d8:84:1c:aa:89:66:aa:26:48:6d:9b:ce:4c:1e:d7:af:7d:02:04:4b:15:91:9e:a0:41:02:4e:fb:96:9f:ec:c1:32:03:e6:a1:87:78:5a:2e:fc:8f:8d:8d:fc:c0:68:71:30:90:c1:1d:ea:43:d9:00:55:7c:9c:bc:29:a7:b1:d7:2d:e9:74:49:3b:dd:2b:1f:46:e4:21:8b:64:97:28:e3:62:8a:f5:04:5f:86:ce:34:0f:65:96:59:24:81:50:d9:61:6b:a9:72:47:4a:80:14:f0:e5:85:ca:f5:77:92:f9:7b:0e:50:b6:bb:b4:b7:e3:55:59:93:11:b2:57:4b:c8:a5:13:3c:da:65:6b:b2:dc:4e:57:8b:6f:7e:3a:ad:8c:f2:d0:ed:d0:bd:a2:bd:b7:63:c5:16:50:de:d9:1f:4c:53:4f:dd:d0:bd:8d:76:8f:13:92:46:2a:76:a0:e7:c4:4a:66:fb:74:d8:ad:63:4f:48:b6:20:26:c7:02:03:01:00:01",
                                                    "x509af.subjectPublicKey_tree": {
                                                        "pkcs1.modulus": "00:fa:59:72:bc:74:76:c0:ad:b9:75:d8:fe:7a:6d:17:32:4e:67:d7:cd:d2:7c:38:7b:63:1e:a7:97:59:92:b8:34:4b:ff:76:d5:b7:e0:45:54:88:89:06:66:26:cc:01:55:b4:26:8e:96:b0:4f:d2:e8:ba:40:9e:29:08:97:5a:72:ea:b5:25:d8:84:1c:aa:89:66:aa:26:48:6d:9b:ce:4c:1e:d7:af:7d:02:04:4b:15:91:9e:a0:41:02:4e:fb:96:9f:ec:c1:32:03:e6:a1:87:78:5a:2e:fc:8f:8d:8d:fc:c0:68:71:30:90:c1:1d:ea:43:d9:00:55:7c:9c:bc:29:a7:b1:d7:2d:e9:74:49:3b:dd:2b:1f:46:e4:21:8b:64:97:28:e3:62:8a:f5:04:5f:86:ce:34:0f:65:96:59:24:81:50:d9:61:6b:a9:72:47:4a:80:14:f0:e5:85:ca:f5:77:92:f9:7b:0e:50:b6:bb:b4:b7:e3:55:59:93:11:b2:57:4b:c8:a5:13:3c:da:65:6b:b2:dc:4e:57:8b:6f:7e:3a:ad:8c:f2:d0:ed:d0:bd:a2:bd:b7:63:c5:16:50:de:d9:1f:4c:53:4f:dd:d0:bd:8d:76:8f:13:92:46:2a:76:a0:e7:c4:4a:66:fb:74:d8:ad:63:4f:48:b6:20:26:c7",
                                                        "pkcs1.publicExponent": "65537"
                                                    }
                                                },
                                                "x509af.extensions": "3",
                                                "x509af.extensions_tree": {
                                                    "x509af.Extension_element": {
                                                        "x509af.extension.id": "2.5.29.19",
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
                                            "x509af.encrypted": "b3:b7:e4:a0:89:58:43:0a:d8:0b:1d:e6:37:62:18:6b:93:cf:53:39:4f:1a:0f:b6:51:85:98:4f:da:c8:a0:aa:eb:d4:ac:a1:70:43:ac:2d:56:80:77:36:78:d1:e8:ee:36:94:cc:87:b0:6b:66:64:9b:3c:24:eb:80:98:f6:9d:16:c6:12:4d:ab:0e:f9:ae:83:39:17:6e:90:24:6d:ea:b0:14:c8:8d:51:ba:fe:fb:e3:51:45:18:5f:df:85:81:d6:08:fc:31:f7:33:ad:d7:8e:81:b6:60:3b:09:e1:ab:28:09:db:4a:78:26:18:e9:50:c2:33:54:5c:39:c4:83:e8:32:7f:6d:a4:6a:0d:73:b1:84:64:85:7a:cb:3b:86:ac:fd:e8:0c:25:72:41:e0:a7:33:44:15:fe:4d:93:70:1f:9d:47:0b:86:da:e8:87:c7:96:d3:53:46:71:50:05:4d:62:58:b8:11:cf:50:70:6e:bd:49:c7:7b:e6:56:60:d5:82:7c:85:7d:b9:8d:7e:3e:b9:5f:9a:25:e7:3f:b5:73:fe:8a:54:70:b4:c2:d7:53:e3:41:a2:d0:27:35:8f:94:03:a4:d4:63:4a:f4:44:15:40:19:e1:8a:ad:a7:24:1f:a8:e2:41:d9:d0:d4:22:37:0c:e2:7d:c7:13:cd:0c"
                                        },
                                        "tls.handshake.extensions_length": "0"
                                    }
                                }
                            }
                        ]
                    }
                ],
                [
                    120,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "0911a29a91ea2da771",
                            "dcid": "eca03c64cff7d334",
                            "scil": "6",
                            "dcil": "5",
                            "payload_length": "300",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "1200",
                                "frame_type.crypto.length": "278",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": ""
                            }
                        ]
                    }
                ],
                [
                    122,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "eca03c64cff7d334",
                            "dcid": "0911a29a91ea2da771",
                            "scil": "5",
                            "dcil": "6",
                            "payload_length": "22",
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
                    126,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Initial",
                            "version": "0xff00000f",
                            "scid": "eca03c64cff7d334",
                            "dcid": "0911a29a91ea2da771",
                            "scil": "5",
                            "dcil": "6",
                            "payload_length": "22",
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
                    127,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "eca03c64cff7d334",
                            "dcid": "0911a29a91ea2da771",
                            "scil": "5",
                            "dcil": "6",
                            "payload_length": "72",
                            "packet_number": "1"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "0",
                                "frame_type.crypto.length": "52",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": {
                                    "tls.handshake.type": "20",
                                    "tls.handshake.length": "48",
                                    "tls.handshake.verify_data": ""
                                }
                            }
                        ]
                    }
                ],
                [
                    227,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "long",
                            "type": "Handshake",
                            "version": "0xff00000f",
                            "scid": "0911a29a91ea2da771",
                            "dcid": "eca03c64cff7d334",
                            "scil": "6",
                            "dcil": "5",
                            "payload_length": "23",
                            "packet_number": "2"
                        },
                        "frames": [
                            {
                                "frame_type": "ACK",
                                "frame_type.ack.largest_acknowledged": "1",
                                "frame_type.ack.ack_delay": "966",
                                "frame_type.ack.ack_block_count": "0",
                                "frame_type.ack.fab": "1"
                            }
                        ]
                    }
                ],
                [
                    228,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "eca03c64cff7d334",
                            "payload_length": "TODO",
                            "packet_number": "0"
                        },
                        "frames": [
                            {
                                "frame_type": "CRYPTO",
                                "frame_type.crypto.offset": "0",
                                "frame_type.crypto.length": "130",
                                "frame_type.crypto.crypto_data": "",
                                "tls.handshake": {
                                    "tls.handshake.type": "4",
                                    "tls.handshake.length": "61",
                                    "TLS Session Ticket": {
                                        "tls.handshake.session_ticket_lifetime_hint": "7200",
                                        "tls.handshake.session_ticket_age_add": "1666706767",
                                        "tls.handshake.session_ticket_nonce_length": "8",
                                        "tls.handshake.session_ticket_nonce": "00:00:00:00:00:00:00:01",
                                        "tls.handshake.session_ticket_length": "32",
                                        "tls.handshake.session_ticket": "12:11:2b:19:93:37:ad:cc:13:a5:f2:88:0d:b1:d8:e1:44:f8:a4:c6:f2:b2:76:37:62:bb:52:ec:2e:eb:a3:a6",
                                        "tls.handshake.extensions_length": "8",
                                        "Extension: early_data (len=4)": {
                                            "tls.handshake.extension.type": "42",
                                            "tls.handshake.extension.len": "4",
                                            "tls.early_data.max_early_data_size": "4294967295"
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ],
                [
                    234,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "0911a29a91ea2da771",
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
                    10004,
                    "TRANSPORT",
                    "PACKET_RX",
                    "LINE",
                    {
                        "raw_encrypted": "TODO",
                        "header": {
                            "form": "short",
                            "dcid": "0911a29a91ea2da771",
                            "payload_length": "TODO",
                            "packet_number": "2"
                        },
                        "frames": [
                            {
                                "frame_type": "APPLICATION_CLOSE",
                                "frame_type.ac.error_code": "0",
                                "frame_type.ac.reason_phrase.length": "0",
                                "frame_type.ac.reason_phrase": ""
                            }
                        ]
                    }
                ]
            ],
        },
    ],
};