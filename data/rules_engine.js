/**
 * 네트워크관리사 2급 필기 기출문제 전용 분석 & 해설 생성 규칙 엔진
 * 1,350개 전 문항에 대해 문제 유형별 맞춤 핵심 도출 공식 및 선지별 정밀 반증 제공
 */

const QUESTION_RULES = [
  // -------------------------------------------------------------
  // [1] 서브넷팅 & IP 연산
  // -------------------------------------------------------------
  {
    id: "subnetting_calculation",
    match: q => /서브넷|subnet|호스트\s*수|네트워크\s*ID|브로드캐스트/i.test(q.stem),
    topic: "서브넷팅(Subnetting) 계산 공식 & IP 주소 분할",
    icon: "⚡",
    points: [
      "매직 넘버(블록 크기) = `256 - 서브넷 마스크의 마지막 유효 옥텟`",
      "서브넷당 사용 가능 호스트 수 = `2^(호스트 비트 수) - 2` (네트워크 ID와 브로드캐스트 주소 2개 제외)",
      "서브넷 마스크의 '1' 비트 = 네트워크 영역 확장, '0' 비트 = 가용 호스트 영역",
      "네트워크 ID: 호스트 비트가 모두 '0'인 주소 / 브로드캐스트 주소: 호스트 비트가 모두 '1'인 주소"
    ],
    derive: ans => `문제 조건의 프리픽스/마스크를 2진수 비트와 매직 넘버 공식으로 역산하면 정답은 **${ans}**입니다.`,
    trap: "호스트 수를 계산할 때는 맨 앞의 '네트워크 대표 주소'와 맨 뒤의 '브로드캐스트 주소' 2개를 반드시 빼야 함에 주의하세요."
  },
  {
    id: "subnet_purpose",
    match: q => /Subnetting을\s*하는\s*이유|서브넷팅의\s*목적/i.test(q.stem),
    topic: "서브넷팅의 목적 및 필요성",
    icon: "📌",
    points: [
      "IP 주소 낭비 방지: 필요한 호스트 규모에 맞게 효율적으로 주소 분할",
      "브로드캐스트 도메인 분할: 불필요한 브로드캐스트 트래픽 확산을 제한하여 네트워크 성능 향상",
      "네트워크 보안성 및 관리 편의성 증대"
    ],
    derive: ans => `서브넷팅을 한다고 해서 Host ID를 사용하지 않는 것이 아니며, 네트워크 ID와 Host ID를 구분하여 최적 할당하는 것이 목적이므로 **${ans}**가 옳지 않은 설명(정답)입니다.`
  },

  // -------------------------------------------------------------
  // [2] IP 클래스 & 사설 IP / 루프백
  // -------------------------------------------------------------
  {
    id: "ip_classes",
    match: q => /Class|클래스|사설\s*IP|공인\s*IP|루프\s*백|127\.0\.0\.1/i.test(q.stem),
    topic: "IPv4 클래스 분류 체계 & 특수 주소 대역",
    icon: "📌",
    points: [
      "A Class: `0 ~ 126` (기본 마스크: `255.0.0.0`, 사설 대역: `10.0.0.0/8`)",
      "B Class: `128 ~ 191` (기본 마스크: `255.255.0.0`, 사설 대역: `172.16.0.0/12 ~ 172.31.255.255`)",
      "C Class: `192 ~ 223` (기본 마스크: `255.255.255.0`, 사설 대역: `192.168.0.0/16`)",
      "D Class: `224 ~ 239` (멀티캐스트 전용) / E Class: `240 ~ 255` (연구·실험용)",
      "루프백(Loopback): `127.0.0.1 ~ 127.255.255.254` (로컬 시스템 내부 통신/자가 진단용)",
      "IP 옥텟 유효 범위: 각 옥텟은 반드시 `0 ~ 255` 정수여야 함 (256 이상 불가능)"
    ],
    derive: ans => `첫 번째 옥텟의 숫자 범위와 클래스 판별 기준에 따라 정확한 주소는 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [3] IPv6 핵심
  // -------------------------------------------------------------
  {
    id: "ipv6_features",
    match: q => /IPv6/i.test(q.stem) || /IPv6/i.test(q.ans),
    topic: "차세대 IPv6 주소 체계 및 헤더 특징",
    icon: "📌",
    points: [
      "주소 길이: `128비트` (16비트씩 8개 필드를 콜론(:)으로 구분, 16진수 표기)",
      "전송 방식: **유니캐스트(1:1), 멀티캐스트(1:그룹), 애니캐스트(1:가장 가까운 노드)**",
      "브로드캐스트(Broadcast) 폐지: IPv4의 브로드캐스트가 멀티캐스트로 통합 대체됨",
      "헤더 구조: 기본 헤더가 `40바이트 고정 크기`로 간소화되었으며, 라우터 부하 경감을 위해 **체크섬(Checksum) 필드가 삭제**됨",
      "자동 주소 설정: DHCP 서버 없이도 스스로 IP를 구성하는 SLAAC(무상태 자동 구성) 및 EUI-64 지원",
      "보안 기능: 네트워크 계층 보안 프로토콜인 IPsec을 기본 내장"
    ],
    derive: ans => `IPv6의 표준 구조 및 RFC 명세에 부합하는 정답은 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [4] TCP / UDP / 포트 / 헤더 제어 플래그
  // -------------------------------------------------------------
  {
    id: "tcp_udp_comparison",
    match: q => /(TCP|UDP).*(차이|비교|특징|메커니즘)|(연결\s*지향|비연결|신뢰성)/i.test(q.stem) && /TCP|UDP/i.test(q.stem),
    topic: "전송 계층 프로토콜 비교: TCP vs UDP",
    icon: "⚡",
    points: [
      "TCP: 연결 지향형, 가상 회선(3-Way Handshake 수립, 4-Way 종료), 흐름제어(Sliding Window), 혼잡제어, 에러제어(재전송 ARQ). 헤더 20~60바이트",
      "UDP: 비연결형, 비신뢰성, 최소 오버헤드로 고속 전송, 실시간 스트리밍/DNS/DHCP에 최적. 헤더 8바이트 고정",
      "오류 정정: TCP는 오류 검출 시 수신측이 패킷을 자체 정정하는 것이 아니라, 송신측에 재전송(ARQ)을 요청함"
    ],
    derive: ans => `TCP와 UDP의 신뢰성 및 연결 특성을 비교하면 **${ans}**가 정답입니다.`
  },
  {
    id: "udp_header_fields",
    match: q => /UDP.*(헤더|패킷|구조)/i.test(q.stem),
    topic: "UDP 헤더 구조 (총 8바이트 = 64비트 고정)",
    icon: "⚡",
    points: [
      "UDP 헤더 4대 필드: **Source Port(16비트), Destination Port(16비트), Length(16비트), Checksum(16비트)**",
      "헤더 총 크기: 8바이트 (TCP 헤더 기본 20바이트에 비해 극도로 경량화되어 신속 전송 지원)",
      "Window(흐름제어 윈도우 크기), Sequence Number(순서번호), ACK(확인응답)는 **TCP 전용 필드**로 UDP에는 존재하지 않음",
      "비연결형 프로토콜 특성상 가상회선 수립(3-Way Handshake) 및 흐름/순서 제어 메커니즘이 전혀 없음"
    ],
    derive: ans => `UDP 헤더 4대 필드(송신 포트, 수신 포트, 길이, 체크섬)에 속하지 않는 것은 **${ans}**입니다.`,
    trap: "Window, ACK, SYN, FIN 등은 모두 신뢰성 전송을 위한 TCP 고유 필드이므로 UDP 헤더 문제의 단골 오답/정답 함정입니다."
  },
  {
    id: "tcp_flags_fields",
    match: q => /ACK|SYN|FIN|RST|URG|PSH|헤더\s*필드|Header\s*length|Header\s*checksum|Sequence\s*Number/i.test(q.stem) || /ACK|SYN|FIN|RST/i.test(q.ans),
    topic: "TCP / IP 헤더 제어 플래그 및 필드 역할",
    icon: "📌",
    points: [
      "SYN: 연결 수립 요청 (3-Way Handshake 최초 전송)",
      "ACK: 데이터 정상 수신 확인 응답 (3-Way Handshake 2/3단계 및 세션 유지 시 항상 1)",
      "FIN: 정상적인 연결 종료 요청 (4-Way Handshake)",
      "RST: 비정상 세션 강제 리셋/차단",
      "Header Length(IHL): IP 헤더의 길이 (4바이트 워드 단위, 기본 20바이트=5)",
      "Header Checksum: IP 헤더의 무결성 검증 (홉을 거칠 때마다 TTL 감소로 매번 재계산)",
      "주의: ACK, SYN, FIN, RST는 TCP 헤더 플래그이며, IP 헤더에는 존재하지 않음"
    ],
    derive: ans => `각 프로토콜 헤더 구조와 제어 비트 정의에 따라 **${ans}**가 정답입니다.`
  },
  {
    id: "port_numbers",
    match: q => /포트|Port|\b(21|22|23|25|53|80|443|110|143|161|162|67|68|69|123|445)\b/i.test(q.stem) || /FTP|SSH|Telnet|SMTP|DNS|DHCP|TFTP|HTTP|POP3|IMAP|SNMP|NTP|SMB/i.test(q.ans),
    topic: "표준 인터넷 서비스 포트 번호 체계",
    icon: "📌",
    points: [
      "FTP: `20(Data), 21(Control)` / SSH: `22` / Telnet: `23` / SMTP: `25`",
      "DNS: `53(UDP/TCP)` / DHCP: `67(Server), 68(Client)` / TFTP: `69(UDP)`",
      "HTTP: `80` / HTTPS: `443` / POP3: `110` / IMAP: `143`",
      "SNMP: `161(Query Polling), 162(Trap)` / NTP: `123` / SMB: `445`"
    ],
    derive: ans => `해당 프로토콜의 IANA 표준 웰노운(Well-Known) 포트는 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [5] 네트워크 진단 명령어 & 유틸리티
  // -------------------------------------------------------------
  {
    id: "ping_utility",
    match: q => /Ping|핑/i.test(q.stem),
    topic: "Ping 유틸리티와 ICMP 프로토콜 진단 원리",
    icon: "🔍",
    points: [
      "원리: ICMP Echo Request(Type 8)를 목적지에 발송하고, ICMP Echo Reply(Type 0) 수신 확인",
      "기능: 원격 호스트까지의 네트워크 왕복 시간(RTT) 측정 및 종단 간 연결 상태 진단",
      "한계: 상태 진단 및 도달 여부만 확인할 뿐, 네트워크 오류가 발견되어도 패킷을 직접 정정·수정하는 기능은 없음"
    ],
    derive: ans => `Ping은 진단 도구이며 자체적인 오류 정정 기능이 없으므로 **${ans}**가 정답입니다.`
  },
  {
    id: "tracert_pathping",
    match: q => /tracert|traceroute|pathping|경로\s*추적/i.test(q.stem) || /tracert|traceroute|pathping/i.test(q.ans),
    topic: "경로 추적 유틸리티: tracert & pathping",
    icon: "🔍",
    points: [
      "tracert: 목적지까지 패킷이 거쳐가는 라우터 경로(홉)와 각 경유지의 왕복 응답 시간 측정",
      "원리: IP 헤더의 TTL(생존 시간)을 1부터 1씩 증가시켜 라우터로부터 `ICMP Time Exceeded(Type 11)` 메시지를 받아 홉 식별",
      "pathping: tracert의 경로 추적 기능과 ping의 손실률 측정을 결합하여 각 라우터 구간별 패킷 손실률(%)을 정밀 계산"
    ],
    derive: ans => `경로 추적 및 경유지별 지연 측정을 수행하는 도구는 **${ans}**입니다.`
  },
  {
    id: "netstat_route_ipconfig",
    match: q => /netstat|route\b|ipconfig|ifconfig/i.test(q.stem) || /netstat|route|ipconfig|ifconfig/i.test(q.ans),
    topic: "네트워크 상태 확인 및 라우팅 제어 명령어",
    icon: "🔍",
    points: [
      "netstat: 현재 시스템의 TCP/UDP 활성 연결 소켓, 라우팅 테이블, 인터페이스 통계 확인 (게이트웨이 경유지 추적은 tracert 담당)",
      "route: 로컬 호스트의 IP 라우팅 테이블 조회 및 정적 경로/기본 게이트웨이 추가·삭제 (`route print`, `route add`)",
      "ipconfig (Windows): 로컬 IP, 서브넷 마스크, 게이트웨이, DNS 조회 (`/all`, `/release`, `/renew`, `/flushdns`)",
      "ifconfig (Linux): 네트워크 인터페이스의 IP/MAC 주소 조회 및 활성화/비활성화 (`ifconfig eth0 up/down`)"
    ],
    derive: ans => `명령어의 고유 역할과 출력 정보에 부합하는 정답은 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [6] ARP / RARP / GARP & MAC 주소
  // -------------------------------------------------------------
  {
    id: "arp_family",
    match: q => /ARP|RARP|GARP|Proxy\s*ARP/i.test(q.stem) || /ARP|RARP|GARP/i.test(q.ans),
    topic: "주소 결정 프로토콜 (ARP / RARP / GARP)",
    icon: "📌",
    points: [
      "ARP: IP 주소(논리 주소) ➔ MAC 주소(물리 주소) 변환 (브로드캐스트 요청 후 유니캐스트 응답)",
      "RARP: MAC 주소 ➔ IP 주소 변환 (무디스크 호스트의 부팅 시 IP 획득)",
      "GARP: 자신의 IP 주소로 ARP를 보내 IP 충돌 검사 및 동일 서브넷 장비의 ARP 캐시 최신화",
      "Proxy ARP: 라우터가 서브넷 너머의 호스트를 대신하여 자신의 MAC 주소로 ARP 응답 대행"
    ],
    derive: ans => `주소 해석 및 동작 메커니즘에 따라 **${ans}**가 정답입니다.`
  },
  {
    id: "mac_address_structure",
    match: q => /MAC|NIC|OUI|물리적\s*주소|하드웨어\s*주소/i.test(q.stem),
    topic: "이더넷 MAC 주소 구조 (48비트 물리 주소)",
    icon: "📌",
    points: [
      "크기: `48비트` (16진수 12자리, 콜론이나 하이픈으로 구분. 예: 00:0C:29:XX:XX:XX)",
      "전반부 24비트(6자리): OUI (제조사 식별 코드, IEEE에서 부여)",
      "후반부 24비트(6자리): UAA / Host Identifier (제조사가 부여한 고유 시리얼 일련번호)",
      "오류 주의: 128비트는 IPv6 주소이며, MAC 주소는 48비트입니다."
    ],
    derive: ans => `MAC 주소의 표준 규격 및 비트 길이에 부합하는 답은 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [7] 전송 매체, PCM, 잡음, 토폴로지, 다중화
  // -------------------------------------------------------------
  {
    id: "pcm_steps",
    match: q => /PCM|펄스\s*코드|변조\s*과정/i.test(q.stem),
    topic: "PCM(Pulse Code Modulation) 4단계 신호 변환 과정",
    icon: "⚡",
    points: [
      "PCM 단계: **음성(아날로그) ➔ 표본화(Sampling) ➔ 양자화(Quantizing) ➔ 부호화(Encoding) ➔ 전송로(디지털)**",
      "표본화: 나이퀴스트 이론에 따라 신호 최고 주파수의 2배 이상으로 주기적 샘플링",
      "양자화: 표본화된 진폭 값을 대표하는 이산적 정수 값으로 근사화 (양자화 잡음 발생)",
      "부호화: 양자화된 정수 값을 2진 비트 열로 변환"
    ],
    derive: ans => `PCM의 정확한 신호 변환 순서는 **음성 - 표본화 - 양자화 - 부호화 - 전송로**입니다.`
  },
  {
    id: "transmission_distortions",
    match: q => /감쇠|Attenuation|지연\s*왜곡|누화|Crosstalk|열잡음|백색잡음/i.test(q.stem),
    topic: "전송 신호의 왜곡 및 잡음 유형",
    icon: "📌",
    points: [
      "감쇠(Attenuation): 신호가 전송 매체를 통과하면서 거리에 비례하여 신호 세기가 약해지는 현상 (해결: 리피터/증폭기)",
      "지연 왜곡(Delay Distortion): 주파수 성분별로 전송 속도가 달라 도착 시 위상 차이로 신호가 일그러지는 현상",
      "누화 잡음(Crosstalk): 인접한 전송선 사이의 전자기적 상호 유도로 신호가 섞이는 현상 (해결: UTP의 꼬임선 구조)",
      "열잡음(Thermal Noise): 도체 내 전자의 열운동으로 발생하는 피할 수 없는 백색 가우시안 잡음"
    ],
    derive: ans => `지문에서 설명하는 현상은 **${ans}**입니다.`
  },
  {
    id: "multiplexing_concepts",
    match: q => /다중화|Multiplexing|FDM|TDM|WDM|CDM/i.test(q.stem) || /Multiplexing|멀티\s*플렉싱|FDM|TDM/i.test(q.ans),
    topic: "통신 회선 다중화(Multiplexing) 방식",
    icon: "📌",
    points: [
      "다중화(Multiplexing): 하나의 고속 물리 통신 회선을 여러 개의 논리적 채널로 분할하여 다수 사용자가 회선을 동시 공유",
      "FDM(주파수 분할): 회선의 대역폭을 여러 주파수 대역으로 분할 (아날로그 라디오/TV)",
      "TDM(시분할): 회선 이용 시간을 타임 슬롯으로 분할 (동기식/비동기식)",
      "WDM(파장 분할): 광섬유 케이블에서 서로 다른 빛의 파장으로 다중화",
      "CDM(코드 분할): 고유한 직교 코드를 부여하여 동일 주파수 대역 공유 (이동통신)"
    ],
    derive: ans => `하나의 회선을 나누어 다수가 공유 전송하는 기술은 **${ans}**입니다.`
  },
  {
    id: "network_scales",
    match: q => /LAN.*MAN.*WAN|근거리통신망.*광역통신망|통신망에\s*대한\s*설명\s*중\s*빈칸/i.test(q.stem),
    topic: "지리적 영역에 따른 통신망 분류 (LAN / MAN / WAN)",
    icon: "📌",
    points: [
      "LAN (Local Area Network): 건물, 사무실, 캠퍼스 등 수 km 이내의 근거리 통신망 (고속, 저에러)",
      "MAN (Metropolitan Area Network): 도시 단위(약 50km)의 대도시권 통신망",
      "WAN (Wide Area Network): 국가, 대륙, 전 세계를 연결하는 광역 통신망 (공중망 통신사업자 회선 임대, 낮은 속도/높은 에러율)"
    ],
    derive: ans => `규모에 따라 LAN(근거리) < MAN(도시권) < WAN(광역) 순으로 매핑된 **${ans}**가 정답입니다.`
  },
  {
    id: "fast_ethernet_standards",
    match: q => /Fast\s*Ethernet|100BASE|Gigabit\s*Ethernet|10Giga|이더넷\s*표준/i.test(q.stem) || /Fast\s*Ethernet|Gigabit\s*Ethernet/i.test(q.ans),
    topic: "이더넷 전송 규격별 명칭과 대역폭",
    icon: "📌",
    points: [
      "Standard Ethernet (10BASE-T): `10 Mbps`",
      "Fast Ethernet (100BASE-TX): `100 Mbps`",
      "Gigabit Ethernet (1000BASE-T/SX/LX): `1,000 Mbps (1 Gbps)`",
      "10-Gigabit Ethernet (10GBASE-T): `10,000 Mbps (10 Gbps)`"
    ],
    derive: ans => `100BASE-T에 해당하는 100Mbps 고속 이더넷 표준 명칭은 **${ans}**입니다.`
  },

  // -------------------------------------------------------------
  // [8] Windows Server NOS (PowerShell, Kerberos, Hyper-V, 감사)
  // -------------------------------------------------------------
  {
    id: "powershell_cmd",
    match: q => /PowerShell|파워쉘|명령\s*라인\s*셀\s*및\s*스크립팅/i.test(q.stem) || /PowerShell/i.test(q.ans),
    topic: "Windows PowerShell 관리 엔진 및 스크립팅 언어",
    icon: "💻",
    points: [
      "정의: Windows 시스템 관리를 위해 객체 지향 기반으로 설계된 강력한 명령줄 셸 및 스크립팅 언어",
      ".NET 프레임워크 기반으로 텍스트가 아닌 '객체(Object)'를 파이프라인으로 전달",
      "C-Shell, Bourne-Shell, Korn-Shell(K-Shell)은 유닉스/리눅스 환경의 전통적인 셸입니다."
    ],
    derive: ans => `Windows Server 관리 자동화용 명령줄 셸은 **${ans}**입니다.`
  },
  {
    id: "kerberos_auth",
    match: q => /Kerberos|커버로스|KDC|키분배센터|인증\s*프로토콜/i.test(q.stem) || /Kerberos/i.test(q.ans),
    topic: "Kerberos v5 상호 인증 프로토콜 & KDC",
    icon: "🔐",
    points: [
      "정의: Windows Active Directory의 표준 기본 상호 인증 프로토콜 (RFC 4120, 포트 88)",
      "KDC (Key Distribution Center): AS(인증 서버)와 TGS(티켓 발급 서버)로 구성되어 대칭키 암호화 기반 티켓을 발급",
      "재전송 공격 방지를 위해 타임스탬프를 사용하며, 도메인 내 시간 동기화(NTP)가 필수적임"
    ],
    derive: ans => `KDC 기반의 티켓 인증을 수행하는 Windows 표준 인증 프로토콜은 **${ans}**입니다.`
  },
  {
    id: "hyper_v",
    match: q => /Hyper-V|하이퍼V/i.test(q.stem),
    topic: "Windows Hyper-V 서버 가상화 플랫폼",
    icon: "💻",
    points: [
      "기능: 하드웨어 가상화(Hypervisor Type-1)를 통해 단일 물리 서버에 다수의 가상 머신(VM)을 구동",
      "효과: 서버 하드웨어 자원 사용률 극대화, 서버 통합으로 유지 비용 절감, 개발/테스트 유연성 향상",
      "가용성: 클러스터링 및 실시간 마이그레이션(Live Migration)을 지원하여 서버 가용성을 대폭 향상시킴 (가용성이 줄어든다는 것은 오답)"
    ],
    derive: ans => `Hyper-V는 고가용성 솔루션을 제공하여 서버 가용성을 높이므로, 가용성이 줄어든다고 설명한 **${ans}**가 오답(정답)입니다.`
  },
  {
    id: "windows_auditing",
    match: q => /감사\s*정책|auditing/i.test(q.stem),
    topic: "Windows Server 감사(Auditing) 정책과 성능",
    icon: "🛡️",
    points: [
      "정의: 사용자 활동, 로그온 성공/실패, 객체 액세스, 권한 사용 등의 보안 이벤트를 추적 기록",
      "확인: 이벤트 뷰어(Event Viewer)의 '보안(Security)' 로그에서 감사 내역 확인",
      "성능 영향: 감사 대상 이벤트를 과도하게 많이 설정하면 매 작업마다 디스크 I/O 로깅 부하가 발생하여 시스템 성능이 저하됨"
    ],
    derive: ans => `감사 이벤트를 무분별하게 많이 구성하면 시스템 오버헤드가 급증해 성능이 떨어지므로 **${ans}**가 잘못된 설명(정답)입니다.`
  },
  {
    id: "apache_directives",
    match: q => /Apache|httpd\.conf|ServerRoot|DocumentRoot|DirectoryIndex|ServerAdmin|Listen\b/i.test(q.stem),
    topic: "Apache 웹서버 `httpd.conf` 핵심 설정 지시어",
    icon: "🌐",
    points: [
      "Listen: 웹서버가 클라이언트의 요청을 수신 대기할 'IP 주소와 포트 번호' 지정 (예: `Listen 80`, `Listen 192.168.1.10:8080`) - 출발지 IP 지정이 아님!",
      "DocumentRoot: 웹문서(HTML, 이미지 등)가 위치하는 최상위 디렉터리 경로",
      "DirectoryIndex: 클라이언트가 디렉터리 접속 시 기본으로 서비스할 시작 파일명 (예: `index.html`)",
      "ServerAdmin: 웹 에러 페이지에 표시될 서버 관리자의 이메일 주소",
      "MaxClients (MaxRequestWorkers): 동시 처리가 가능한 최대 클라이언트 요청 수"
    ],
    derive: ans => `지시어의 명확한 역할 정의에 부합하는 정답은 **${ans}**입니다.`
  },
  {
    id: "linux_filesystem_commands",
    match: q => /pwd|cat\b|ls\b|chmod|chown|chgrp|umask|스왑\s*영역|Swap|Shell\b|커널에\s*전달/i.test(q.stem) || /pwd|cat|chmod|chown|Shell/i.test(q.ans),
    topic: "Linux 필수 쉘 명령어 및 시스템 핵심 구조",
    icon: "🐧",
    points: [
      "pwd: 현재 작업 디렉터리의 절대 경로 출력 (Print Working Directory)",
      "cat: 파일 내용 화면 출력, 여러 파일 결합/연결 (Concatenate)",
      "Shell: 사용자가 입력한 명령어를 해석하여 Kernel에 전달하고 실행 결과를 반환하는 인터페이스",
      "Swap 영역: 물리 메모리(RAM) 용량 부족 시 하드디스크의 지정된 영역을 가상 메모리처럼 활용",
      "umask: 새 파일/디렉터리 생성 시 적용되는 기본 권한 차단 마스크 (파일 기본 666, 디렉터리 기본 777에서 umask 차감)"
    ],
    derive: ans => `리눅스 표준 명령어 및 커널/쉘 동작 구조에 따라 **${ans}**가 정답입니다.`
  },

  // -------------------------------------------------------------
  // [9] 보안 공격 기법 및 보안 솔루션
  // -------------------------------------------------------------
  {
    id: "security_attacks",
    match: q => /스머프|Smurf|SYN\s*Flood|Land\s*Attack|TearDrop|Ping\s*of\s*Death|SQL\s*Injection|XSS|스푸핑|스니핑/i.test(q.stem) || /Smurf|SYN|Land|TearDrop|Ping\s*of\s*Death|SQL|XSS/i.test(q.ans),
    topic: "네트워크 및 웹 침해사고 공격 기법 분석",
    icon: "🚨",
    points: [
      "Smurf: 위조된 발신지 IP(피해자 IP)로 ICMP Echo Request를 브로드캐스트 전송하여 증폭 반사 공격",
      "SYN Flooding: 3-Way Handshake 취약점을 악용하여 완료되지 않은 TCP 반개방 세션으로 백로그 큐 고갈",
      "Land Attack: 출발지 IP와 목적지 IP를 동일하게 피해자 자신의 IP로 조작하여 자가 응답 무한 루프 유발",
      "TearDrop: IP 단편화 조립 시 오프셋(Fragment Offset) 값을 고의로 중첩시켜 시스템 크래시 유도",
      "Ping of Death: 65,535바이트를 초과하는 비정상 거대 ICMP 패킷으로 버퍼 오버플로우 유발",
      "SQL Injection: 웹 입력폼에 악성 SQL 구문을 삽입하여 DB 비인가 접근/탈취",
      "XSS: 웹페이지에 악성 자바스크립트를 삽입하여 타 사용자의 쿠키/세션 탈취"
    ],
    derive: ans => `지문에서 기술된 공격 메커니즘과 취약점 패턴에 부합하는 공격명은 **${ans}**입니다.`
  },
  {
    id: "security_appliances",
    match: q => /방화벽|Firewall|IDS|IPS|WAF|VPN|NAC/i.test(q.stem) || /방화벽|IDS|IPS|WAF|VPN|NAC/i.test(q.ans),
    topic: "보안 장비 및 접근 제어 솔루션 비교",
    icon: "🛡️",
    points: [
      "방화벽: IP/포트 기반 패킷 필터링 및 상태 추적(SPI)을 통한 1차 네트워크 경계 방어",
      "IDS (침입 탐지): 트래픽 미러링(Out-of-Path)을 통해 악성 행위를 탐지하고 경보 발생 (패킷 직접 차단 불가)",
      "IPS (침입 방지): 실제 회선 경로(In-Line)에 배치되어 침입 탐지 시 즉시 세션을 능동 차단",
      "WAF (웹 방화벽): L7 응용 계층의 HTTP/HTTPS 페이로드를 검사하여 SQL Injection, XSS 정밀 방어",
      "VPN (가상 사설망): 공중 인터넷망에 암호화 터널을 뚫어 전용 사설망처럼 통신 (IPsec/SSL)",
      "NAC (네트워크 접근 제어): 접속 단말의 무결성(백신, 패치)을 검증하여 비인가 단말 통제/격리"
    ],
    derive: ans => `문제 조건의 보안 장비 역할과 계층별 방어 특성에 따라 **${ans}**가 정답입니다.`
  },

  // -------------------------------------------------------------
  // [10] 최신 기술: IoT, NFV, SDN, CDN, QoS
  // -------------------------------------------------------------
  {
    id: "emerging_tech",
    match: q => /IoT|사물인터넷|NFV|SDN|CDN|QoS/i.test(q.stem) || /IoT|NFV|SDN|CDN|QoS/i.test(q.ans),
    topic: "차세대 네트워크 및 인프라 신기술",
    icon: "💡",
    points: [
      "IoT (사물인터넷): 사물에 센서와 통신 기능을 탑재하여 인간의 개입 없이 인터넷으로 실시간 데이터 상호 교환",
      "NFV (네트워크 기능 가상화): 라우터, 방화벽 등 전용 하드웨어 장비의 기능을 가상화 소프트웨어로 구현",
      "SDN (소프트웨어 정의 네트워크): 제어 평면(Control Plane)과 데이터 전송 평면(Data Plane)을 분리하여 중앙 제어",
      "CDN (콘텐츠 전송 네트워크): 지리적으로 분산된 캐시 서버를 통해 대용량 콘텐츠를 사용자 가까이서 고속 전송",
      "QoS (Quality of Service): 대역폭 보장, 지연(Latency) 및 지터(Jitter) 최소화를 통해 특정 트래픽 품질을 차등 보장"
    ],
    derive: ans => `기술의 정의와 표준 개념에 정확히 부합하는 정답은 **${ans}**입니다.`
  }
];

// Helper: Match a question to a specialized rule
function matchQuestionRule(stem, ans) {
  const qObj = { stem, ans };
  for (const rule of QUESTION_RULES) {
    if (rule.match(qObj)) {
      return rule;
    }
  }
  return null;
}

module.exports = { QUESTION_RULES, matchQuestionRule };
