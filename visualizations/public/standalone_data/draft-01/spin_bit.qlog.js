var spin_bit = {
    "qlog_version": "draft-01",
    "title": "qlog from pcap spin_bit.pcap",
    "description": "qlog from pcap spin_bit.pcap",
    "traces": [
        {
            "title": "Connection 1 in qlog from pcap spin_bit.pcap",
            "description": "Connection 1 in qlog from pcap spin_bit.pcap",
            "vantage_point": {
                "name": "TODO",
                "type": "network",
                "flow": "client"
            },
            "configuration": {
                "time_offset": "0",
                "time_units": "ms",
                "original_uris": [
                    "file:///home/tom/Code/pcap2qlog/examples/draft-01/spin_bit.json"
                ]
            },
            "common_fields": {
                "group_id": "1b51237b269288d6",
                "protocol_type": "QUIC",
                "reference_time": "1564682471.651907"
            },
            "event_fields": [
                "relative_time",
                "category",
                "event",
                "trigger",
                "data"
            ],
            "events": [
                [
                    "0",
                    "connectivity",
                    "connection_new",
                    "line",
                    {
                        "ip_version": "4",
                        "src_ip": "66.70.231.124",
                        "dst_ip": "51.15.3.76",
                        "transport_protocol": "UDP",
                        "src_port": "52740",
                        "dst_port": "4433",
                        "quic_version": "0xff000016",
                        "src_cid": "1b51237b269288d6",
                        "dst_cid": "0f721e1c6aae0420"
                    }
                ],
                [
                    "0",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "initial",
                        "header": {
                            "form": "long",
                            "version": "0xff000016",
                            "scid": "1b51237b269288d6",
                            "dcid": "0f721e1c6aae0420",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": "1225"
                        },
                        "frames": [
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "278"
                            },
                            {
                                "frame_type": "padding"
                            }
                        ]
                    }
                ],
                [
                    "93",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "initial",
                        "header": {
                            "form": "long",
                            "version": "0xff000016",
                            "scid": "9605d1700dd8829c",
                            "dcid": "1b51237b269288d6",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": "601"
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "451",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "155"
                            }
                        ]
                    }
                ],
                [
                    "93",
                    "connectivity",
                    "connection_id_update",
                    "line",
                    {
                        "dst_old": "0f721e1c6aae0420",
                        "dst_new": "9605d1700dd8829c"
                    }
                ],
                [
                    "93",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "handshake",
                        "header": {
                            "form": "long",
                            "version": "0xff000016",
                            "scid": "9605d1700dd8829c",
                            "dcid": "1b51237b269288d6",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": "601"
                        },
                        "frames": [
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "580"
                            }
                        ]
                    }
                ],
                [
                    "93",
                    "transport",
                    "ALPN_update",
                    {
                        "old": "",
                        "new": "hq-22"
                    }
                ],
                [
                    "97",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "initial",
                        "header": {
                            "form": "long",
                            "version": "0xff000016",
                            "scid": "1b51237b269288d6",
                            "dcid": "9605d1700dd8829c",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": "23"
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "389",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "98",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "handshake",
                        "header": {
                            "form": "long",
                            "version": "0xff000016",
                            "scid": "1b51237b269288d6",
                            "dcid": "9605d1700dd8829c",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": "78"
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "545",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "52"
                            }
                        ]
                    }
                ],
                [
                    "100",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 128
                        },
                        "frames": [
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "4",
                                "connection_id": "b6d99a21a5520037",
                                "length": "8",
                                "reset_token": "c8b17dea7e522c4e2e226a30baf67ecd"
                            },
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "3",
                                "connection_id": "9ea9d2d7fe0968af",
                                "length": "8",
                                "reset_token": "65c029e5897850b701041d8282a41ed0"
                            },
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "2",
                                "connection_id": "dc1e741dd48a68f0",
                                "length": "8",
                                "reset_token": "821b8b277bae3b95628bbc91d61ac863"
                            },
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "1",
                                "connection_id": "85355bb1f6a57ff9",
                                "length": "8",
                                "reset_token": "4300194ae56baba583eafe6853467617"
                            }
                        ]
                    }
                ],
                [
                    "101",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 36
                        },
                        "frames": [
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "length": "17",
                                "fin": true,
                                "raw": "474554202f696e6465782e68746d6c0d0a"
                            }
                        ]
                    }
                ],
                [
                    "103",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 22
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "348",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "103",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": true
                    }
                ],
                [
                    "208",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "handshake",
                        "header": {
                            "form": "short",
                            "version": "0xff000016",
                            "scid": "9605d1700dd8829c",
                            "dcid": "1b51237b269288d6",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 114
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "9",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "208",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "version": "0xff000016",
                            "scid": "9605d1700dd8829c",
                            "dcid": "1b51237b269288d6",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 114
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "9",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "89"
                            }
                        ]
                    }
                ],
                [
                    "208",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": false
                    }
                ],
                [
                    "211",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 22
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "322",
                                "acked_ranges": [
                                    [
                                        "1",
                                        "1"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "211",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": true
                    }
                ],
                [
                    "218",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 23
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "16",
                                "acked_ranges": [
                                    [
                                        "1",
                                        "1"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "max_streams",
                                "maximum": "33"
                            }
                        ]
                    }
                ],
                [
                    "220",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 22
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "310",
                                "acked_ranges": [
                                    [
                                        "2",
                                        "2"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "220",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": false
                    }
                ],
                [
                    "224",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 238
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "1394",
                                "acked_ranges": [
                                    [
                                        "1",
                                        "1"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "max_data",
                                "maximum": "10000017"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "length": "207",
                                "fin": true,
                                "raw": "3c21444f43545950452068746d6c3e0a3c68746d6c206c616e673d22656e223e0a3c686561643e0a20203c7469746c653e51554943207465737420706167653c2f7469746c653e0a3c2f686561643e0a3c626f64793e0a20203c68313e48656c6c6f20576f726c64213c2f68313e0a20203c6120687265663d22384d223e384d6942206f662072616e646f6d20646174613c2f613e0a20203c6120687265663d2233324d223e33324d6942206f662072616e646f6d20646174613c2f613e0a3c2f626f64793e0a3c2f68746d6c3e0a"
                            }
                        ]
                    }
                ],
                [
                    "224",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": true
                    }
                ],
                [
                    "227",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 73
                        },
                        "frames": [
                            {
                                "frame_type": "max_data",
                                "maximum": "32975"
                            },
                            {
                                "frame_type": "max_stream_data",
                                "id": "0",
                                "maximum": "16591"
                            },
                            {
                                "frame_type": "ack",
                                "ack_delay": "321",
                                "acked_ranges": [
                                    [
                                        "3",
                                        "3"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "stream",
                                "id": "8",
                                "length": "17",
                                "fin": true,
                                "raw": "474554202f696e6465782e68746d6c0d0a"
                            },
                            {
                                "frame_type": "stream",
                                "id": "4",
                                "length": "17",
                                "fin": true,
                                "raw": "474554202f696e6465782e68746d6c0d0a"
                            }
                        ]
                    }
                ],
                [
                    "227",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": false
                    }
                ],
                [
                    "322",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 21
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "5",
                                "acked_ranges": [
                                    [
                                        "2",
                                        "4"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "328",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 451
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "1245",
                                "acked_ranges": [
                                    [
                                        "2",
                                        "4"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "max_data",
                                "maximum": "10000051"
                            },
                            {
                                "frame_type": "max_streams",
                                "maximum": "35"
                            },
                            {
                                "frame_type": "stream",
                                "id": "4",
                                "length": "207",
                                "fin": true,
                                "raw": "3c21444f43545950452068746d6c3e0a3c68746d6c206c616e673d22656e223e0a3c686561643e0a20203c7469746c653e51554943207465737420706167653c2f7469746c653e0a3c2f686561643e0a3c626f64793e0a20203c68313e48656c6c6f20576f726c64213c2f68313e0a20203c6120687265663d22384d223e384d6942206f662072616e646f6d20646174613c2f613e0a20203c6120687265663d2233324d223e33324d6942206f662072616e646f6d20646174613c2f613e0a3c2f626f64793e0a3c2f68746d6c3e0a"
                            },
                            {
                                "frame_type": "stream",
                                "id": "8",
                                "length": "207",
                                "fin": true,
                                "raw": "3c21444f43545950452068746d6c3e0a3c68746d6c206c616e673d22656e223e0a3c686561643e0a20203c7469746c653e51554943207465737420706167653c2f7469746c653e0a3c2f686561643e0a3c626f64793e0a20203c68313e48656c6c6f20576f726c64213c2f68313e0a20203c6120687265663d22384d223e384d6942206f662072616e646f6d20646174613c2f613e0a20203c6120687265663d2233324d223e33324d6942206f662072616e646f6d20646174613c2f613e0a3c2f626f64793e0a3c2f68746d6c3e0a"
                            }
                        ]
                    }
                ],
                [
                    "331",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 39
                        },
                        "frames": [
                            {
                                "frame_type": "max_data",
                                "maximum": "33389"
                            },
                            {
                                "frame_type": "max_stream_data",
                                "id": "4",
                                "maximum": "16591"
                            },
                            {
                                "frame_type": "max_stream_data",
                                "id": "8",
                                "maximum": "16591"
                            },
                            {
                                "frame_type": "ack",
                                "ack_delay": "320",
                                "acked_ranges": [
                                    [
                                        "5",
                                        "5"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "331",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": true
                    }
                ],
                [
                    "425",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 21
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "7",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "5"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "10001",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "9605d1700dd8829c",
                            "payload_length": 27
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "1196985",
                                "acked_ranges": [
                                    [
                                        "6",
                                        "6"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "connection_close",
                                "error_space": "transport_error",
                                "error_code": "http_no_error",
                                "raw_error_code": "0",
                                "reason": ""
                            }
                        ]
                    }
                ],
                [
                    "10001",
                    "connectivity",
                    "connection_close",
                    {
                        "src_id": "1b51237b269288d6"
                    }
                ],
                [
                    "10001",
                    "connectivity",
                    "spin_bit_update",
                    "line",
                    {
                        "state": false
                    }
                ],
                [
                    "10091",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "type": "1RTT",
                        "header": {
                            "form": "short",
                            "dcid": "1b51237b269288d6",
                            "payload_length": 20
                        },
                        "frames": [
                            {
                                "frame_type": "connection_close",
                                "error_space": "transport_error",
                                "error_code": "no_error",
                                "raw_error_code": "0",
                                "reason": "",
                                "trigger_frame_type": "0"
                            }
                        ]
                    }
                ],
                [
                    "10091",
                    "connectivity",
                    "connection_close",
                    {
                        "src_id": "9605d1700dd8829c"
                    }
                ]
            ]
        }
    ]
}