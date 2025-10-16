var new_id = {
    "qlog_version": "draft-01",
    "description": "",
    "traces": [
        {
            "title": "Connection 1",
            "vantage_point": {
                "name": "TODO",
                "type": "network",
                "flow": "client"
            },
            "configuration": {
                "time_offset": "0",
                "time_units": "ms",
                "original_uris": [
                    "file:///srv/pcap2qlog/examples/draft-01/new_cid.json"
                ]
            },
            "common_fields": {
                "group_id": "7e37e4dcc6682da8",
                "protocol_type": "QUIC",
                "reference_time": "1564658098.991056"
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
                        "src_ip": "130.104.228.79",
                        "dst_ip": "52.58.13.57",
                        "transport_protocol": "UDP",
                        "src_port": "40618",
                        "dst_port": "4433",
                        "quic_version": "0xff000016",
                        "src_cid": "7e37e4dcc6682da8",
                        "dst_cid": "36ce104eee50101c"
                    }
                ],
                [
                    "0",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "initial",
                        "header": {
                            "version": "0xff000016",
                            "scid": "7e37e4dcc6682da8",
                            "dcid": "36ce104eee50101c",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 1224,
                            "packet_number": "0",
                            "packet_size": 1251
                        },
                        "frames": [
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "284"
                            },
                            {
                                "frame_type": "padding"
                            }
                        ]
                    }
                ],
                [
                    "23",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "initial",
                        "header": {
                            "version": "0xff000016",
                            "scid": "f55e7d8368835d6e",
                            "dcid": "7e37e4dcc6682da8",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 192,
                            "packet_number": "0",
                            "packet_size": 219
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "0",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "padding"
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
                    "23",
                    "connectivity",
                    "connection_id_update",
                    "line",
                    {
                        "dst_old": "36ce104eee50101c",
                        "dst_new": "f55e7d8368835d6e"
                    }
                ],
                [
                    "23",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "handshake",
                        "header": {
                            "version": "0xff000016",
                            "scid": "f55e7d8368835d6e",
                            "dcid": "7e37e4dcc6682da8",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 656,
                            "packet_number": "2",
                            "packet_size": 682
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "2376",
                                "length": "618"
                            }
                        ]
                    }
                ],
                [
                    "24",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "handshake",
                        "header": {
                            "version": "0xff000016",
                            "scid": "f55e7d8368835d6e",
                            "dcid": "7e37e4dcc6682da8",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 1226,
                            "packet_number": "0",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "1188"
                            }
                        ]
                    }
                ],
                [
                    "24",
                    "transport",
                    "ALPN_update",
                    "line",
                    {
                        "old": "",
                        "new": "hq-22"
                    }
                ],
                [
                    "24",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "handshake",
                        "header": {
                            "version": "0xff000016",
                            "scid": "f55e7d8368835d6e",
                            "dcid": "7e37e4dcc6682da8",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 1226,
                            "packet_number": "1",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "1188",
                                "length": "1188"
                            }
                        ]
                    }
                ],
                [
                    "24",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "7e37e4dcc6682da8",
                            "payload_length": 293,
                            "packet_number": "0",
                            "packet_size": 303
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "crypto",
                                "offset": "0",
                                "length": "169"
                            },
                            {
                                "frame_type": "new_token",
                                "length": "40",
                                "token": "8272cb09a56af7878fd16c402d4baa3f6aa4ca0d8d9c8f4f6042edca88c8735bf55e7d8368835d6e"
                            },
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "1",
                                "connection_id": "25809357bfaa6859",
                                "length": "8",
                                "reset_token": "e7209df3d312e8fc6ea13cdcde35712a"
                            }
                        ]
                    }
                ],
                [
                    "26",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "initial",
                        "header": {
                            "version": "0xff000016",
                            "scid": "7e37e4dcc6682da8",
                            "dcid": "f55e7d8368835d6e",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 22,
                            "packet_number": "1",
                            "packet_size": 48
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "308",
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
                    "27",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "handshake",
                        "header": {
                            "version": "0xff000016",
                            "scid": "7e37e4dcc6682da8",
                            "dcid": "f55e7d8368835d6e",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 77,
                            "packet_number": "0",
                            "packet_size": 103
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "396",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "2"
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
                    "27",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "f55e7d8368835d6e",
                            "payload_length": 70,
                            "packet_number": "0",
                            "packet_size": 80
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "343",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "0",
                                "length": "17",
                                "fin": true
                            },
                            {
                                "frame_type": "new_connection_id",
                                "retire_prior_to": "0",
                                "sequence_number": "1",
                                "connection_id": "c7bb8e6e462100e1",
                                "length": "8",
                                "reset_token": "7d8e22cb74a926b976dd907e14ab7dc1"
                            }
                        ]
                    }
                ],
                [
                    "29",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "25809357bfaa6859",
                            "payload_length": 22,
                            "packet_number": "1",
                            "packet_size": 32
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "623",
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
                    "29",
                    "connectivity",
                    "connection_id_update",
                    "line",
                    {
                        "src_old": "7e37e4dcc6682da8",
                        "src_new": "25809357bfaa6859"
                    }
                ],
                [
                    "44",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "handshake",
                        "header": {
                            "version": "0xff000016",
                            "scid": "f55e7d8368835d6e",
                            "dcid": "7e37e4dcc6682da8",
                            "scil": "8",
                            "dcil": "8",
                            "payload_length": 21,
                            "packet_number": "3",
                            "packet_size": 47
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "0",
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
                    "45",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 23,
                            "packet_number": "1",
                            "packet_size": 33
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "0",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "0"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "retire_connection_id",
                                "sequence_number": "0"
                            }
                        ]
                    }
                ],
                [
                    "45",
                    "connectivity",
                    "connection_id_update",
                    "line",
                    {
                        "dst_old": "f55e7d8368835d6e",
                        "dst_new": "c7bb8e6e462100e1"
                    }
                ],
                [
                    "47",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "25809357bfaa6859",
                            "payload_length": 22,
                            "packet_number": "2",
                            "packet_size": 32
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "280",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "1"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "2",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "0",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "3",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "1188",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "4",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "2376",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "5",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "3564",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "6",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "4752",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "7",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "5940",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "8",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "7128",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "9",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "8316",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 1242,
                            "packet_number": "10",
                            "packet_size": 1252
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "9504",
                                "fin": false
                            }
                        ]
                    }
                ],
                [
                    "48",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 280,
                            "packet_number": "11",
                            "packet_size": 290
                        },
                        "frames": [
                            {
                                "frame_type": "padding"
                            },
                            {
                                "frame_type": "stream",
                                "id": "0",
                                "offset": "10692",
                                "length": "226",
                                "fin": true
                            }
                        ]
                    }
                ],
                [
                    "50",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "25809357bfaa6859",
                            "payload_length": 33,
                            "packet_number": "3",
                            "packet_size": 43
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "204",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "11"
                                    ]
                                ]
                            },
                            {
                                "frame_type": "max_data",
                                "maximum": "97146"
                            },
                            {
                                "frame_type": "max_stream_data",
                                "id": "0",
                                "maximum": "80762"
                            }
                        ]
                    }
                ],
                [
                    "68",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 21,
                            "packet_number": "12",
                            "packet_size": 31
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "0",
                                "acked_ranges": [
                                    [
                                        "1",
                                        "3"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                [
                    "9998",
                    "transport",
                    "packet_received",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "25809357bfaa6859",
                            "payload_length": 27,
                            "packet_number": "4",
                            "packet_size": 37
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "1241285",
                                "acked_ranges": [
                                    [
                                        "0",
                                        "12"
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
                    "9998",
                    "connectivity",
                    "connection_close",
                    "line",
                    {
                        "src_id": "c7bb8e6e462100e1"
                    }
                ],
                [
                    "10016",
                    "transport",
                    "packet_sent",
                    "line",
                    {
                        "packet_type": "1RTT",
                        "header": {
                            "dcid": "c7bb8e6e462100e1",
                            "payload_length": 24,
                            "packet_number": "13",
                            "packet_size": 34
                        },
                        "frames": [
                            {
                                "frame_type": "ack",
                                "ack_delay": "0",
                                "acked_ranges": [
                                    [
                                        "4",
                                        "4"
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
                    "10016",
                    "connectivity",
                    "connection_close",
                    "line",
                    {
                        "src_id": "25809357bfaa6859"
                    }
                ]
            ]
        }
    ]
}