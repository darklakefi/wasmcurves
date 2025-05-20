const utils = require("../utils");

const buildF1m =require("../build_f1m.js");
const buildF1 =require("../build_f1.js");
const buildF2m =require("../build_f2m.js");
const buildF3m =require("../build_f3m.js");
const buildCurve =require("../build_curve_jacobian_a0.js");
const buildFFT = require("../build_fft");
const buildPol = require("../build_pol");
const buildQAP = require("../build_qap");
const buildApplyKey = require("../build_applykey");
const { bitLength, isOdd, isNegative } = require("../bigint.js");

// Definition here: https://electriccoin.co/blog/new-snark-curve/

module.exports = function buildBLS12377(module, _prefix) {

    const prefix = _prefix || "bls12377";

    if (module.modules[prefix]) return prefix;  // already builded

    // replaced
    const q = 0x01ae3a4617c510eac63b05c06ca1493b1a22d9f300f5138f1ef3622fba094800170b5d44300000008508c00000000001n;
    // replaced
    const r = 0x12ab655e9a2ca55660b44d1e5c37b00159aa76fed00000010a11800000000001n;

    const n64q = Math.floor((bitLength(q - 1n) - 1)/64) +1;
    const n8q = n64q*8;
    const f1size = n8q;
    const f2size = f1size * 2;
    const ftsize = f1size * 12;

    const n64r = Math.floor((bitLength(r - 1n) - 1)/64) +1;
    const n8r = n64r*8;
    const frsize = n8r;


    const pr = module.alloc(utils.bigInt2BytesLE( r, frsize ));

    const f1mPrefix = buildF1m(module, q, "f1m", "intq");
    buildF1(module, r, "fr", "frm", "intr");
    const pG1b = module.alloc(utils.bigInt2BytesLE( toMontgomery(4n), f1size ));
    const g1mPrefix = buildCurve(module, "g1m", "f1m", pG1b);

    buildFFT(module, "frm", "frm", "frm", "frm_mul");

    buildPol(module, "pol", "frm");
    buildQAP(module, "qap", "frm");

    const f2mPrefix = buildF2m(module, "f1m_neg", "f2m", "f1m");
    const pG2b = module.alloc([
        ...utils.bigInt2BytesLE( toMontgomery(4n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(4n), f1size )
    ]);
    const g2mPrefix = buildCurve(module, "g2m", "f2m", pG2b);


    function buildGTimesFr(fnName, opMul) {
        const f = module.addFunction(fnName);
        f.addParam("pG", "i32");
        f.addParam("pFr", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const AUX = c.i32_const(module.alloc(n8r));

        f.addCode(
            c.call("frm_fromMontgomery", c.getLocal("pFr"), AUX),
            c.call(
                opMul,
                c.getLocal("pG"),
                AUX,
                c.i32_const(n8r),
                c.getLocal("pr")
            )
        );

        module.exportFunction(fnName);
    }
    buildGTimesFr("g1m_timesFr", "g1m_timesScalar");
    buildFFT(module, "g1m", "g1m", "frm", "g1m_timesFr");

    buildGTimesFr("g2m_timesFr", "g2m_timesScalar");
    buildFFT(module, "g2m", "g2m", "frm", "g2m_timesFr");

    buildGTimesFr("g1m_timesFrAffine", "g1m_timesScalarAffine");
    buildGTimesFr("g2m_timesFrAffine", "g2m_timesScalarAffine");

    buildApplyKey(module, "frm_batchApplyKey", "fmr", "frm", n8r, n8r, n8r, "frm_mul");
    buildApplyKey(module, "g1m_batchApplyKey", "g1m", "frm", n8q*3, n8q*3, n8r, "g1m_timesFr");
    buildApplyKey(module, "g1m_batchApplyKeyMixed", "g1m", "frm", n8q*2, n8q*3, n8r, "g1m_timesFrAffine");
    buildApplyKey(module, "g2m_batchApplyKey", "g2m", "frm", n8q*2*3, n8q*3*2, n8r, "g2m_timesFr");
    buildApplyKey(module, "g2m_batchApplyKeyMixed", "g2m", "frm", n8q*2*2, n8q*3*2, n8r, "g2m_timesFrAffine");


    function toMontgomery(a) {
        return BigInt(a) * (1n << BigInt(f1size*8)) % q;
    }

    const G1gen = [
        // replaced
        81937999373150964239938255573465948239988671502647976594219695644855304257327692006745978603320413799295628339695n,
        // replaced
        241266749859715473739788878240585681733927191168601896383759122102112907357779751001206799952863815012735208165030n,
        1n
    ];

    const pG1gen = module.alloc(
        [
            ...utils.bigInt2BytesLE( toMontgomery(G1gen[0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G1gen[1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G1gen[2]), f1size ),
        ]
    );

    const G1zero = [
        0n,
        1n,
        0n
    ];

    const pG1zero = module.alloc(
        [
            ...utils.bigInt2BytesLE( toMontgomery(G1zero[0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G1zero[1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G1zero[2]), f1size )
        ]
    );

    const G2gen = [
        [
            // replaced
            233578398248691099356572568220835526895379068987715365179118596935057653620464273615301663571204657964920925606294n,
            // replaced
            140913150380207355837477652521042157274541796891053068589147167627541651775299824604154852141315666357241556069118n,
        ],[
            // replaced
            63160294768292073209381361943935198908131692476676907196754037919244929611450776219210369229519898517858833747423n,
            // replaced
            149157405641012693445398062341192467754805999074082136895788947234480009303640899064710353187729182149407503257491n,
        ],[
            // match
            1n,
            // match
            0n,
        ]
    ];

    const pG2gen = module.alloc(
        [
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[0][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[0][1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[1][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[1][1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[2][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2gen[2][1]), f1size ),
        ]
    );

    const G2zero = [
        [
            0n,
            0n,
        ],[
            1n,
            0n,
        ],[
            0n,
            0n,
        ]
    ];

    const pG2zero = module.alloc(
        [
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[0][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[0][1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[1][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[1][1]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[2][0]), f1size ),
            ...utils.bigInt2BytesLE( toMontgomery(G2zero[2][1]), f1size ),
        ]
    );

    const pOneT = module.alloc([
        ...utils.bigInt2BytesLE( toMontgomery(1n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(0n), f1size ),
    ]);

    const pBls12377Twist =  module.alloc([
        ...utils.bigInt2BytesLE( toMontgomery(1n), f1size ),
        ...utils.bigInt2BytesLE( toMontgomery(1n), f1size ),
    ]);

    function build_mulNR2() {
        const f = module.addFunction(f2mPrefix + "_mulNR");
        f.addParam("x", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const x0c = c.i32_const(module.alloc(f1size));
        const x0 = c.getLocal("x");
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(f1size));
        const r0 = c.getLocal("pr");
        const r1 = c.i32_add(c.getLocal("pr"), c.i32_const(f1size));

        f.addCode(
            c.call(f1mPrefix+"_copy", x0, x0c),
            c.call(f1mPrefix+"_sub", x0, x1, r0),
            c.call(f1mPrefix+"_add", x0c, x1, r1),
        );
    }
    build_mulNR2();

    const f6mPrefix = buildF3m(module, f2mPrefix+"_mulNR", "f6m", "f2m");

    function build_mulNR6() {
        const f = module.addFunction(f6mPrefix + "_mulNR");
        f.addParam("x", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        const c0copy = c.i32_const(module.alloc(f1size*2));

        f.addCode(
            c.call(
                f2mPrefix + "_copy",
                c.getLocal("x"),
                c0copy
            ),
            c.call(
                f2mPrefix + "_mulNR",
                c.i32_add(c.getLocal("x"), c.i32_const(n8q*4)),
                c.getLocal("pr")
            ),
            c.call(
                f2mPrefix + "_copy",
                c.i32_add(c.getLocal("x"), c.i32_const(n8q*2)),
                c.i32_add(c.getLocal("pr"), c.i32_const(n8q*4)),
            ),
            c.call(
                f2mPrefix + "_copy",
                c0copy,
                c.i32_add(c.getLocal("pr"), c.i32_const(n8q*2)),
            ),
        );
    }
    build_mulNR6();

    const ftmPrefix = buildF2m(module, f6mPrefix+"_mulNR", "ftm", f6mPrefix);

    // replaced
    const ateLoopCount = 0x8508c00000000001n; // 0xd201000000010000n;
    const ateLoopBitBytes = bits(ateLoopCount);
    const pAteLoopBitBytes = module.alloc(ateLoopBitBytes);
    const isLoopNegative = false;

    const ateCoefSize = 3 * f2size;
    const ateNDblCoefs = ateLoopBitBytes.length-1;
    const ateNAddCoefs = ateLoopBitBytes.reduce((acc, b) =>  acc + ( b!=0 ? 1 : 0)   ,0);
    const ateNCoefs = ateNAddCoefs + ateNDblCoefs + 1;
    const prePSize = 3*2*n8q;
    const preQSize = 3*n8q*2 + ateNCoefs*ateCoefSize;
    const finalExpIsNegative = false;

    // replaced
    const finalExpZ = 9586122913090633729n; // 15132376222941642752n;


    module.modules[prefix] = {
        n64q: n64q,
        n64r: n64r,
        n8q: n8q,
        n8r: n8r,
        pG1gen: pG1gen,
        pG1zero: pG1zero,
        pG1b: pG1b,
        pG2gen: pG2gen,
        pG2zero: pG2zero,
        pG2b: pG2b,
        pq: module.modules["f1m"].pq,
        pr: pr,
        pOneT: pOneT,
        r: r,
        q: q,
        prePSize: prePSize,
        preQSize: preQSize
    };


    function naf(n) {
        let E = n;
        const res = [];
        while (E > 0n) {
            if (isOdd(E)) {
                const z = 2 - Number(E % 4n);
                res.push( z );
                E = E - BigInt(z);
            } else {
                res.push( 0 );
            }
            E = E >> 1n;
        }
        return res;
    }

    function bits(n) {
        let E = n;
        const res = [];
        while (E > 0n) {
            if (isOdd(E)) {
                res.push( 1 );
            } else {
                res.push( 0 );
            }
            E = E >> 1n;
        }
        return res;
    }

    function buildPrepareG1() {
        const f = module.addFunction(prefix+ "_prepareG1");
        f.addParam("pP", "i32");
        f.addParam("ppreP", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            c.call(g1mPrefix + "_normalize", c.getLocal("pP"), c.getLocal("ppreP")),  // TODO Remove if already in affine
        );
    }



    function buildPrepDoubleStep() {
        const f = module.addFunction(prefix+ "_prepDblStep");
        f.addParam("R", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const Rx  = c.getLocal("R");
        const Ry  = c.i32_add(c.getLocal("R"), c.i32_const(2*n8q));
        const Rz  = c.i32_add(c.getLocal("R"), c.i32_const(4*n8q));

        const t0  = c.getLocal("r");
        const t3  = c.i32_add(c.getLocal("r"), c.i32_const(2*n8q));
        const t6  = c.i32_add(c.getLocal("r"), c.i32_const(4*n8q));


        const zsquared = c.i32_const(module.alloc(f2size));
        const t1 = c.i32_const(module.alloc(f2size));
        const t2 = c.i32_const(module.alloc(f2size));
        const t4 = c.i32_const(module.alloc(f2size));
        const t5 = c.i32_const(module.alloc(f2size));

        f.addCode(

            // tmp0 = r.x.square();
            c.call(f2mPrefix + "_square", Rx, t0),

            // tmp1 = r.y.square();
            c.call(f2mPrefix + "_square", Ry, t1),

            // tmp2 = tmp1.square();
            c.call(f2mPrefix + "_square", t1, t2),

            // tmp3 = (tmp1 + r.x).square() - tmp0 - tmp2;
            c.call(f2mPrefix + "_add", t1, Rx, t3),
            c.call(f2mPrefix + "_square", t3, t3),
            c.call(f2mPrefix + "_sub", t3, t0, t3),
            c.call(f2mPrefix + "_sub", t3, t2, t3),

            // tmp3 = tmp3 + tmp3;
            c.call(f2mPrefix + "_add", t3, t3, t3),

            // tmp4 = tmp0 + tmp0 + tmp0;
            c.call(f2mPrefix + "_add", t0, t0, t4),
            c.call(f2mPrefix + "_add", t4, t0, t4),

            // tmp6 = r.x + tmp4;
            c.call(f2mPrefix + "_add", Rx, t4, t6),

            // tmp5 = tmp4.square();
            c.call(f2mPrefix + "_square", t4, t5),

            // zsquared = r.z.square();
            c.call(f2mPrefix + "_square", Rz, zsquared),

            // r.x = tmp5 - tmp3 - tmp3;
            c.call(f2mPrefix + "_sub", t5, t3, Rx),
            c.call(f2mPrefix + "_sub", Rx, t3, Rx),

            // r.z = (r.z + r.y).square() - tmp1 - zsquared;
            c.call(f2mPrefix + "_add", Rz, Ry, Rz),
            c.call(f2mPrefix + "_square", Rz, Rz),
            c.call(f2mPrefix + "_sub", Rz, t1, Rz),
            c.call(f2mPrefix + "_sub", Rz, zsquared, Rz),

            // r.y = (tmp3 - r.x) * tmp4;
            c.call(f2mPrefix + "_sub", t3, Rx, Ry),
            c.call(f2mPrefix + "_mul", Ry, t4, Ry),

            // tmp2 = tmp2 + tmp2;
            c.call(f2mPrefix + "_add", t2, t2, t2),

            // tmp2 = tmp2 + tmp2;
            c.call(f2mPrefix + "_add", t2, t2, t2),

            // tmp2 = tmp2 + tmp2;
            c.call(f2mPrefix + "_add", t2, t2, t2),

            // r.y -= tmp2;
            c.call(f2mPrefix + "_sub", Ry, t2, Ry),

            // tmp3 = tmp4 * zsquared;
            c.call(f2mPrefix + "_mul", t4, zsquared, t3),

            // tmp3 = tmp3 + tmp3;
            c.call(f2mPrefix + "_add", t3, t3, t3),

            // tmp3 = -tmp3;
            c.call(f2mPrefix + "_neg", t3, t3),

            // tmp6 = tmp6.square() - tmp0 - tmp5;
            c.call(f2mPrefix + "_square", t6, t6),
            c.call(f2mPrefix + "_sub", t6, t0, t6),
            c.call(f2mPrefix + "_sub", t6, t5, t6),

            // tmp1 = tmp1 + tmp1;
            c.call(f2mPrefix + "_add", t1, t1, t1),

            // tmp1 = tmp1 + tmp1;
            c.call(f2mPrefix + "_add", t1, t1, t1),

            // tmp6 = tmp6 - tmp1;
            c.call(f2mPrefix + "_sub", t6, t1, t6),

            // tmp0 = r.z * zsquared;
            c.call(f2mPrefix + "_mul", Rz, zsquared, t0),

            // tmp0 = tmp0 + tmp0;
            c.call(f2mPrefix + "_add", t0, t0, t0),

        );
    }

    function buildPrepAddStep() {
        const f = module.addFunction(prefix+ "_prepAddStep");
        f.addParam("R", "i32");
        f.addParam("Q", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const Rx  = c.getLocal("R");
        const Ry  = c.i32_add(c.getLocal("R"), c.i32_const(2*n8q));
        const Rz  = c.i32_add(c.getLocal("R"), c.i32_const(4*n8q));

        const Qx  = c.getLocal("Q");
        const Qy  = c.i32_add(c.getLocal("Q"), c.i32_const(2*n8q));

        const t10  = c.getLocal("r");
        const t1  = c.i32_add(c.getLocal("r"), c.i32_const(2*n8q));
        const t9  = c.i32_add(c.getLocal("r"), c.i32_const(4*n8q));

        const zsquared = c.i32_const(module.alloc(f2size));
        const ysquared = c.i32_const(module.alloc(f2size));
        const ztsquared = c.i32_const(module.alloc(f2size));
        const t0 = c.i32_const(module.alloc(f2size));
        const t2 = c.i32_const(module.alloc(f2size));
        const t3 = c.i32_const(module.alloc(f2size));
        const t4 = c.i32_const(module.alloc(f2size));
        const t5 = c.i32_const(module.alloc(f2size));
        const t6 = c.i32_const(module.alloc(f2size));
        const t7 = c.i32_const(module.alloc(f2size));
        const t8 = c.i32_const(module.alloc(f2size));

        f.addCode(

            // zsquared = r.z.square();
            c.call(f2mPrefix + "_square", Rz, zsquared),

            // ysquared = q.y.square();
            c.call(f2mPrefix + "_square", Qy, ysquared),

            // t0 = zsquared * q.x;
            c.call(f2mPrefix + "_mul", zsquared, Qx, t0),

            // t1 = ((q.y + r.z).square() - ysquared - zsquared) * zsquared;
            c.call(f2mPrefix + "_add", Qy, Rz, t1),
            c.call(f2mPrefix + "_square", t1, t1),
            c.call(f2mPrefix + "_sub", t1, ysquared, t1),
            c.call(f2mPrefix + "_sub", t1, zsquared, t1),
            c.call(f2mPrefix + "_mul", t1, zsquared, t1),

            // t2 = t0 - r.x;
            c.call(f2mPrefix + "_sub", t0, Rx, t2),

            // t3 = t2.square();
            c.call(f2mPrefix + "_square", t2, t3),

            // t4 = t3 + t3;
            c.call(f2mPrefix + "_add", t3, t3, t4),

            // t4 = t4 + t4;
            c.call(f2mPrefix + "_add", t4, t4, t4),

            // t5 = t4 * t2;
            c.call(f2mPrefix + "_mul", t4, t2, t5),

            // t6 = t1 - r.y - r.y;
            c.call(f2mPrefix + "_sub", t1, Ry, t6),
            c.call(f2mPrefix + "_sub", t6, Ry, t6),

            // t9 = t6 * q.x;
            c.call(f2mPrefix + "_mul", t6, Qx, t9),

            // t7 = t4 * r.x;
            c.call(f2mPrefix + "_mul", t4, Rx, t7),

            // r.x = t6.square() - t5 - t7 - t7;
            c.call(f2mPrefix + "_square", t6, Rx),
            c.call(f2mPrefix + "_sub", Rx, t5, Rx),
            c.call(f2mPrefix + "_sub", Rx, t7, Rx),
            c.call(f2mPrefix + "_sub", Rx, t7, Rx),

            // r.z = (r.z + t2).square() - zsquared - t3;
            c.call(f2mPrefix + "_add", Rz, t2, Rz),
            c.call(f2mPrefix + "_square", Rz, Rz),
            c.call(f2mPrefix + "_sub", Rz, zsquared, Rz),
            c.call(f2mPrefix + "_sub", Rz, t3, Rz),

            // t10 = q.y + r.z;
            c.call(f2mPrefix + "_add", Qy, Rz, t10),

            // t8 = (t7 - r.x) * t6;
            c.call(f2mPrefix + "_sub", t7, Rx, t8),
            c.call(f2mPrefix + "_mul", t8, t6, t8),

            // t0 = r.y * t5;
            c.call(f2mPrefix + "_mul", Ry, t5, t0),

            // t0 = t0 + t0;
            c.call(f2mPrefix + "_add", t0, t0, t0),

            // r.y = t8 - t0;
            c.call(f2mPrefix + "_sub", t8, t0, Ry),

            // t10 = t10.square() - ysquared;
            c.call(f2mPrefix + "_square", t10, t10),
            c.call(f2mPrefix + "_sub", t10, ysquared, t10),

            // ztsquared = r.z.square();
            c.call(f2mPrefix + "_square", Rz, ztsquared),

            // t10 = t10 - ztsquared;
            c.call(f2mPrefix + "_sub", t10, ztsquared, t10),

            // t9 = t9 + t9 - t10;
            c.call(f2mPrefix + "_add", t9, t9, t9),
            c.call(f2mPrefix + "_sub", t9, t10, t9),

            // t10 = r.z + r.z;
            c.call(f2mPrefix + "_add", Rz, Rz, t10),

            // t6 = -t6;
            c.call(f2mPrefix + "_neg", t6, t6),

            // t1 = t6 + t6;
            c.call(f2mPrefix + "_add", t6, t6, t1),
        );
    }


    function buildPrepareG2() {
        const f = module.addFunction(prefix+ "_prepareG2");
        f.addParam("pQ", "i32");
        f.addParam("ppreQ", "i32");
        f.addLocal("pCoef", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();


        const Q = c.getLocal("pQ");

        const pR = module.alloc(f2size*3);
        const R = c.i32_const(pR);

        const base = c.getLocal("ppreQ");

        f.addCode(
            c.call(g2mPrefix + "_normalize", Q, base),
            c.if(
                c.call(g2mPrefix + "_isZero", base),
                c.ret([])
            ),
            c.call(g2mPrefix + "_copy", base, R),
            c.setLocal("pCoef", c.i32_add(c.getLocal("ppreQ"), c.i32_const(f2size*3))),
        );

        f.addCode(
            c.setLocal("i", c.i32_const(ateLoopBitBytes.length-2)),
            c.block(c.loop(

                c.call(prefix + "_prepDblStep", R, c.getLocal("pCoef")),
                c.setLocal("pCoef", c.i32_add(c.getLocal("pCoef"), c.i32_const(ateCoefSize))),

                c.if(
                    c.i32_load8_s(c.getLocal("i"), pAteLoopBitBytes),
                    [
                        ...c.call(prefix + "_prepAddStep", R, base, c.getLocal("pCoef")),
                        ...c.setLocal("pCoef", c.i32_add(c.getLocal("pCoef"), c.i32_const(ateCoefSize))),
                    ]
                ),
                c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
                c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
                c.br(0)
            ))
        );
    }


    function buildF6Mul1() {
        const f = module.addFunction(f6mPrefix+ "_mul1");
        f.addParam("pA", "i32");    // F6
        f.addParam("pC1", "i32");   // F2
        f.addParam("pR", "i32");    // F6

        const c = f.getCodeBuilder();

        const A_c0 = c.getLocal("pA");
        const A_c1 = c.i32_add(c.getLocal("pA"), c.i32_const(f1size*2));
        const A_c2 = c.i32_add(c.getLocal("pA"), c.i32_const(f1size*4));

        const c1  = c.getLocal("pC1");

        const t1 = c.getLocal("pR");
        const t2 = c.i32_add(c.getLocal("pR"), c.i32_const(f1size*2));
        const b_b = c.i32_add(c.getLocal("pR"), c.i32_const(f1size*4));

        const Ac0_Ac1 = c.i32_const(module.alloc(f1size*2));
        const Ac1_Ac2 = c.i32_const(module.alloc(f1size*2));

        f.addCode(

            c.call(f2mPrefix + "_add", A_c0, A_c1, Ac0_Ac1),
            c.call(f2mPrefix + "_add", A_c1, A_c2, Ac1_Ac2),

            // let b_b = self.c1 * c1;
            c.call(f2mPrefix + "_mul", A_c1, c1, b_b),

            // let t1 = (self.c1 + self.c2) * c1 - b_b;
            c.call(f2mPrefix + "_mul", Ac1_Ac2, c1, t1),
            c.call(f2mPrefix + "_sub", t1, b_b, t1),

            // let t1 = t1.mul_by_nonresidue();
            c.call(f2mPrefix + "_mulNR", t1, t1),

            // let t2 = (self.c0 + self.c1) * c1 - b_b;
            c.call(f2mPrefix + "_mul", Ac0_Ac1, c1, t2),
            c.call(f2mPrefix + "_sub", t2, b_b, t2),
        );
    }
    buildF6Mul1();

    function buildF6Mul01() {
        const f = module.addFunction(f6mPrefix+ "_mul01");
        f.addParam("pA", "i32");    // F6
        f.addParam("pC0", "i32");   // F2
        f.addParam("pC1", "i32");   // F2
        f.addParam("pR", "i32");    // F6

        const c = f.getCodeBuilder();

        const A_c0 = c.getLocal("pA");
        const A_c1 = c.i32_add(c.getLocal("pA"), c.i32_const(f1size*2));
        const A_c2 = c.i32_add(c.getLocal("pA"), c.i32_const(f1size*4));

        const c0  = c.getLocal("pC0");
        const c1  = c.getLocal("pC1");

        const t1 = c.getLocal("pR");
        const t2 = c.i32_add(c.getLocal("pR"), c.i32_const(f1size*2));
        const t3 = c.i32_add(c.getLocal("pR"), c.i32_const(f1size*4));

        const a_a = c.i32_const(module.alloc(f1size*2));
        const b_b = c.i32_const(module.alloc(f1size*2));
        const Ac0_Ac1 = c.i32_const(module.alloc(f1size*2));
        const Ac0_Ac2 = c.i32_const(module.alloc(f1size*2));

        f.addCode(
            // let a_a = self.c0 * c0;
            c.call(f2mPrefix + "_mul", A_c0, c0, a_a),

            // let b_b = self.c1 * c1;
            c.call(f2mPrefix + "_mul", A_c1, c1, b_b),


            c.call(f2mPrefix + "_add", A_c0, A_c1, Ac0_Ac1),
            c.call(f2mPrefix + "_add", A_c0, A_c2, Ac0_Ac2),

            // let t1 = (self.c1 + self.c2) * c1 - b_b;
            c.call(f2mPrefix + "_add", A_c1, A_c2, t1),
            c.call(f2mPrefix + "_mul", t1, c1, t1),
            c.call(f2mPrefix + "_sub", t1, b_b, t1),

            // let t1 = t1.mul_by_nonresidue() + a_a;
            c.call(f2mPrefix + "_mulNR", t1, t1),
            c.call(f2mPrefix + "_add", t1, a_a, t1),

            // let t2 = (c0 + c1) * (self.c0 + self.c1) - a_a - b_b;
            c.call(f2mPrefix + "_add", c0, c1, t2),
            c.call(f2mPrefix + "_mul", t2, Ac0_Ac1, t2),
            c.call(f2mPrefix + "_sub", t2, a_a, t2),
            c.call(f2mPrefix + "_sub", t2, b_b, t2),

            // let t3 = (self.c0 + self.c2) * c0 - a_a + b_b;
            c.call(f2mPrefix + "_mul", Ac0_Ac2, c0, t3),
            c.call(f2mPrefix + "_sub", t3, a_a, t3),
            c.call(f2mPrefix + "_add", t3, b_b, t3),


        );
    }
    buildF6Mul01();


    function buildF12Mul014() {

        const f = module.addFunction(ftmPrefix+ "_mul014");
        f.addParam("pA", "i32");    // F12
        f.addParam("pC0", "i32");   // F2
        f.addParam("pC1", "i32");   // F2
        f.addParam("pC4", "i32");   // F2
        f.addParam("pR", "i32");    // F12

        const c = f.getCodeBuilder();


        const A_c0 = c.getLocal("pA");
        const A_c1 = c.i32_add(c.getLocal("pA"), c.i32_const(f1size*6));

        const c0  = c.getLocal("pC0");
        const c1  = c.getLocal("pC1");
        const c4  = c.getLocal("pC4");

        const aa = c.i32_const(module.alloc(f1size*6));
        const bb = c.i32_const(module.alloc(f1size*6));
        const o = c.i32_const(module.alloc(f1size*2));

        const R_c0 = c.getLocal("pR");
        const R_c1 = c.i32_add(c.getLocal("pR"), c.i32_const(f1size*6));

        f.addCode(
            // let aa = self.c0.mul_by_01(c0, c1);
            c.call(f6mPrefix + "_mul01", A_c0, c0, c1, aa),

            // let bb = self.c1.mul_by_1(c4);
            c.call(f6mPrefix + "_mul1", A_c1, c4, bb),

            // let o = c1 + c4;
            c.call(f2mPrefix + "_add", c1, c4, o),

            // let c1 = self.c1 + self.c0;
            c.call(f6mPrefix + "_add", A_c1, A_c0, R_c1),

            // let c1 = c1.mul_by_01(c0, &o);
            c.call(f6mPrefix + "_mul01", R_c1, c0, o, R_c1),

            // let c1 = c1 - aa - bb;
            c.call(f6mPrefix + "_sub", R_c1, aa, R_c1),
            c.call(f6mPrefix + "_sub", R_c1, bb, R_c1),

            // let c0 = bb;
            c.call(f6mPrefix + "_copy", bb, R_c0),

            // let c0 = c0.mul_by_nonresidue();
            c.call(f6mPrefix + "_mulNR", R_c0, R_c0),

            // let c0 = c0 + aa;
            c.call(f6mPrefix + "_add", R_c0, aa, R_c0),
        );
    }
    buildF12Mul014();


    function buildELL() {
        const f = module.addFunction(prefix+ "_ell");
        f.addParam("pP", "i32");
        f.addParam("pCoefs", "i32");
        f.addParam("pF", "i32");

        const c = f.getCodeBuilder();

        const Px  = c.getLocal("pP");
        const Py  = c.i32_add(c.getLocal("pP"), c.i32_const(n8q));

        const F  = c.getLocal("pF");

        const coef0_0  = c.getLocal("pCoefs");
        const coef0_1  = c.i32_add(c.getLocal("pCoefs"), c.i32_const(f1size));
        const coef1_0  = c.i32_add(c.getLocal("pCoefs"), c.i32_const(f1size*2));
        const coef1_1  = c.i32_add(c.getLocal("pCoefs"), c.i32_const(f1size*3));
        const coef2  = c.i32_add(c.getLocal("pCoefs"), c.i32_const(f1size*4));

        const pc0 = module.alloc(f1size*2);
        const c0  = c.i32_const(pc0);
        const c0_c0 = c.i32_const(pc0);
        const c0_c1 = c.i32_const(pc0+f1size);

        const pc1 = module.alloc(f1size*2);
        const c1  = c.i32_const(pc1);
        const c1_c0 = c.i32_const(pc1);
        const c1_c1 = c.i32_const(pc1+f1size);
        f.addCode(
            //     let mut c0 = coeffs.0;
            //     let mut c1 = coeffs.1;
            //
            //    c0.c0 *= p.y;
            //    c0.c1 *= p.y;
            //
            //    c1.c0 *= p.x;
            //    c1.c1 *= p.x;
            //
            //     f.mul_by_014(&coeffs.2, &c1, &c0)

            c.call(f1mPrefix + "_mul", coef0_0, Py, c0_c0),
            c.call(f1mPrefix + "_mul", coef0_1, Py, c0_c1),
            c.call(f1mPrefix + "_mul", coef1_0, Px, c1_c0),
            c.call(f1mPrefix + "_mul", coef1_1, Px, c1_c1),

            c.call(ftmPrefix + "_mul014", F, coef2, c1, c0, F),

        );

    }
    buildELL();

    function buildMillerLoop() {
        const f = module.addFunction(prefix+ "_millerLoop");
        f.addParam("ppreP", "i32");
        f.addParam("ppreQ", "i32");
        f.addParam("r", "i32");
        f.addLocal("pCoef", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        const preP = c.getLocal("ppreP");

        const coefs  = c.getLocal("pCoef");

        const F = c.getLocal("r");


        f.addCode(
            c.call(ftmPrefix + "_one", F),

            c.if(
                c.call(g1mPrefix + "_isZero", preP),
                c.ret([])
            ),
            c.if(
                c.call(g1mPrefix + "_isZero", c.getLocal("ppreQ")),
                c.ret([])
            ),
            c.setLocal("pCoef", c.i32_add( c.getLocal("ppreQ"), c.i32_const(f2size*3))),

            c.setLocal("i", c.i32_const(ateLoopBitBytes.length-2)),
            c.block(c.loop(


                c.call(prefix + "_ell", preP, coefs,  F),
                c.setLocal("pCoef", c.i32_add(c.getLocal("pCoef"), c.i32_const(ateCoefSize))),

                c.if(
                    c.i32_load8_s(c.getLocal("i"), pAteLoopBitBytes),
                    [
                        ...c.call(prefix + "_ell", preP, coefs,  F),
                        ...c.setLocal("pCoef", c.i32_add(c.getLocal("pCoef"), c.i32_const(ateCoefSize))),
                    ]
                ),
                c.call(ftmPrefix + "_square", F, F),

                c.br_if(1, c.i32_eq ( c.getLocal("i"), c.i32_const(1) )),
                c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
                c.br(0)
            )),
            c.call(prefix + "_ell", preP, coefs,  F),

        );


        if (isLoopNegative) {
            f.addCode(
                c.call(ftmPrefix + "_conjugate", F, F),
            );
        }
    }


    function buildFrobeniusMap(n) {
        const F12 = [
            // matches
            [
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
            ],
            [
                // Fp2::NONRESIDUE^(((q^0) - 1) / 6)
                // matched     
                [1n, 0n],
                // Fp2::NONRESIDUE^(((q^1) - 1) / 6)
                // replaced
                [92949345220277864758624960506473182677953048909283248980960104381795901929519566951595905490535835115111760994353n, 0n],
                  
                // Fp2::NONRESIDUE^(((q^8) - 1) / 6)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n, 0n],
                 
                // Fp2::NONRESIDUE^(((q^3) - 1) / 6)
                // replaced
                [216465761340224619389371505802605247630151569547285782856803747159100223055385581585702401816380679166954762214499n, 0n],

                // Fp2::NONRESIDUE^(((q^4) - 1) / 6)
                // replaced
                [80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n, 0n],

                // Fp2::NONRESIDUE^(((q^5) - 1) / 6)
                // replaced
                [123516416119946754630746545296132064952198520638002533875843642777304321125866014634106496325844844051843001220146n, 0n],

                // Fp2::NONRESIDUE^(((q^6) - 1) / 6)
                // replaced -> p (q) - 1
                [258664426012969094010652733694893533536393512754914660539884262666720468348340822774968888139573360124440321458176n, 0n],
                
                // Fp2::NONRESIDUE^(((q^7) - 1) / 6)
                // replaced
                [165715080792691229252027773188420350858440463845631411558924158284924566418821255823372982649037525009328560463824n, 0n],


                // Fp2::NONRESIDUE^(((q^8) - 1) / 6)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n, 0n],


                // Fp2::NONRESIDUE^(((q^9) - 1) / 6)
                // replaced
                [42198664672744474621281227892288285906241943207628877683080515507620245292955241189266486323192680957485559243678n, 0n],


                // Fp2::NONRESIDUE^(((q^10) - 1) / 6)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047232n, 0n],

                // Fp2::NONRESIDUE^(((q^11) - 1) / 6)
                // replaced
                [135148009893022339379906188398761468584194992116912126664040619889416147222474808140862391813728516072597320238031n, 0n],
            ]
        ];

        const F6 = [
            // matches
            [
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
                [1n, 0n],
            ],
            [
                // Fp2::NONRESIDUE^(((q^0) - 1) / 3)
                // matches
                [1n, 0n],

                // Fp2::NONRESIDUE^(((q^1) - 1) / 3)
                // replaced
                [80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410946n, 0n],

                // Fp2::NONRESIDUE^(((q^2) - 1) / 3)
                // replaced
                [80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n, 0n],

                // Fp2::NONRESIDUE^(((q^3) - 1) / 3)
                // replaced
                [258664426012969094010652733694893533536393512754914660539884262666720468348340822774968888139573360124440321458176n, 0n],

                // Fp2::NONRESIDUE^(((q^4) - 1) / 3)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n, 0n],

                // Fp2::NONRESIDUE^(((q^5) - 1) / 3)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047232n, 0n],
            ],
            [
                // Fp2::NONRESIDUE^((2*(q^0) - 2) / 3)
                // matches
                [1n, 0n],

                // Fp2::NONRESIDUE^((2*(q^1) - 2) / 3)
                // replaced
                [80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n, 0n],

                // Fp2::NONRESIDUE^((2*(q^2) - 2) / 3)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n, 0n],

                // Fp2::NONRESIDUE^((2*(q^3) - 2) / 3)
                // replaced
                [1n, 0n],

                // Fp2::NONRESIDUE^((2*(q^4) - 2) / 3)
                // replaced
                [80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n, 0n],

                // Fp2::NONRESIDUE^((2*(q^5) - 2) / 3)
                // replaced
                [258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n, 0n],
            ]
        ];

        const f = module.addFunction(ftmPrefix + "_frobeniusMap"+n);
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        for (let i=0; i<6; i++) {
            const X = (i==0) ? c.getLocal("x") : c.i32_add(c.getLocal("x"), c.i32_const(i*f2size));
            const Xc0 = X;
            const Xc1 = c.i32_add(c.getLocal("x"), c.i32_const(i*f2size + f1size));
            const R = (i==0) ? c.getLocal("r") : c.i32_add(c.getLocal("r"), c.i32_const(i*f2size));
            const Rc0 = R;
            const Rc1 = c.i32_add(c.getLocal("r"), c.i32_const(i*f2size + f1size));
            const coef = mul2(F12[Math.floor(i/3)][n%12] , F6[i%3][n%6]);
            const pCoef = module.alloc([
                ...utils.bigInt2BytesLE(toMontgomery(coef[0]), n8q),
                ...utils.bigInt2BytesLE(toMontgomery(coef[1]), n8q),
            ]);
            if (n%2 == 1) {
                f.addCode(
                    c.call(f1mPrefix + "_copy", Xc0, Rc0),
                    c.call(f1mPrefix + "_neg", Xc1, Rc1),
                    c.call(f2mPrefix + "_mul", R, c.i32_const(pCoef), R),
                );
            } else {
                f.addCode(c.call(f2mPrefix + "_mul", X, c.i32_const(pCoef), R));
            }
        }

        function mul2(a, b) {
            const ac0 = a[0];
            const ac1 = a[1];
            const bc0 = b[0];
            const bc1 = b[1];
            const res = [
                (ac0 * bc0 - (ac1 * bc1)) % q,
                (ac0 * bc1 + (ac1 * bc0)) % q,
            ];
            if (isNegative(res[0])) res[0] = res[0] + q;
            return res;
        }

    }


    function buildCyclotomicSquare() {
        const f = module.addFunction(prefix+ "__cyclotomicSquare");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const x0 = c.getLocal("x");
        const x4 = c.i32_add(c.getLocal("x"), c.i32_const(f2size));
        const x3 = c.i32_add(c.getLocal("x"), c.i32_const(2*f2size));
        const x2 = c.i32_add(c.getLocal("x"), c.i32_const(3*f2size));
        const x1 = c.i32_add(c.getLocal("x"), c.i32_const(4*f2size));
        const x5 = c.i32_add(c.getLocal("x"), c.i32_const(5*f2size));

        const r0 = c.getLocal("r");
        const r4 = c.i32_add(c.getLocal("r"), c.i32_const(f2size));
        const r3 = c.i32_add(c.getLocal("r"), c.i32_const(2*f2size));
        const r2 = c.i32_add(c.getLocal("r"), c.i32_const(3*f2size));
        const r1 = c.i32_add(c.getLocal("r"), c.i32_const(4*f2size));
        const r5 = c.i32_add(c.getLocal("r"), c.i32_const(5*f2size));

        const t0 = c.i32_const(module.alloc(f2size));
        const t1 = c.i32_const(module.alloc(f2size));
        const t2 = c.i32_const(module.alloc(f2size));
        const t3 = c.i32_const(module.alloc(f2size));
        const t4 = c.i32_const(module.alloc(f2size));
        const t5 = c.i32_const(module.alloc(f2size));
        const tmp = c.i32_const(module.alloc(f2size));
        const AUX = c.i32_const(module.alloc(f2size));


        f.addCode(
            //    // t0 + t1*y = (z0 + z1*y)^2 = a^2
            //    tmp = z0 * z1;
            //    t0 = (z0 + z1) * (z0 + my_Fp6::non_residue * z1) - tmp - my_Fp6::non_residue * tmp;
            //    t1 = tmp + tmp;
            c.call(f2mPrefix + "_mul", x0, x1, tmp),
            c.call(f2mPrefix + "_mulNR", x1, t0),
            c.call(f2mPrefix + "_add", x0, t0, t0),
            c.call(f2mPrefix + "_add", x0, x1, AUX),
            c.call(f2mPrefix + "_mul", AUX, t0, t0),
            c.call(f2mPrefix + "_mulNR", tmp, AUX),
            c.call(f2mPrefix + "_add", tmp, AUX, AUX),
            c.call(f2mPrefix + "_sub", t0, AUX, t0),
            c.call(f2mPrefix + "_add", tmp, tmp, t1),

            //  // t2 + t3*y = (z2 + z3*y)^2 = b^2
            //  tmp = z2 * z3;
            //  t2 = (z2 + z3) * (z2 + my_Fp6::non_residue * z3) - tmp - my_Fp6::non_residue * tmp;
            //  t3 = tmp + tmp;
            c.call(f2mPrefix + "_mul", x2, x3, tmp),
            c.call(f2mPrefix + "_mulNR", x3, t2),
            c.call(f2mPrefix + "_add", x2, t2, t2),
            c.call(f2mPrefix + "_add", x2, x3, AUX),
            c.call(f2mPrefix + "_mul", AUX, t2, t2),
            c.call(f2mPrefix + "_mulNR", tmp, AUX),
            c.call(f2mPrefix + "_add", tmp, AUX, AUX),
            c.call(f2mPrefix + "_sub", t2, AUX, t2),
            c.call(f2mPrefix + "_add", tmp, tmp, t3),

            //  // t4 + t5*y = (z4 + z5*y)^2 = c^2
            //  tmp = z4 * z5;
            //  t4 = (z4 + z5) * (z4 + my_Fp6::non_residue * z5) - tmp - my_Fp6::non_residue * tmp;
            //  t5 = tmp + tmp;
            c.call(f2mPrefix + "_mul", x4, x5, tmp),
            c.call(f2mPrefix + "_mulNR", x5, t4),
            c.call(f2mPrefix + "_add", x4, t4, t4),
            c.call(f2mPrefix + "_add", x4, x5, AUX),
            c.call(f2mPrefix + "_mul", AUX, t4, t4),
            c.call(f2mPrefix + "_mulNR", tmp, AUX),
            c.call(f2mPrefix + "_add", tmp, AUX, AUX),
            c.call(f2mPrefix + "_sub", t4, AUX, t4),
            c.call(f2mPrefix + "_add", tmp, tmp, t5),

            // For A
            // z0 = 3 * t0 - 2 * z0
            c.call(f2mPrefix + "_sub", t0, x0, r0),
            c.call(f2mPrefix + "_add", r0, r0, r0),
            c.call(f2mPrefix + "_add", t0, r0, r0),
            // z1 = 3 * t1 + 2 * z1
            c.call(f2mPrefix + "_add", t1, x1, r1),
            c.call(f2mPrefix + "_add", r1, r1, r1),
            c.call(f2mPrefix + "_add", t1, r1, r1),

            // For B
            // z2 = 3 * (xi * t5) + 2 * z2
            c.call(f2mPrefix + "_mul", t5, c.i32_const(pBls12377Twist), AUX),
            c.call(f2mPrefix + "_add", AUX, x2, r2),
            c.call(f2mPrefix + "_add", r2, r2, r2),
            c.call(f2mPrefix + "_add", AUX, r2, r2),
            // z3 = 3 * t4 - 2 * z3
            c.call(f2mPrefix + "_sub", t4, x3, r3),
            c.call(f2mPrefix + "_add", r3, r3, r3),
            c.call(f2mPrefix + "_add", t4, r3, r3),

            // For C
            // z4 = 3 * t2 - 2 * z4
            c.call(f2mPrefix + "_sub", t2, x4, r4),
            c.call(f2mPrefix + "_add", r4, r4, r4),
            c.call(f2mPrefix + "_add", t2, r4, r4),
            // z5 = 3 * t3 + 2 * z5
            c.call(f2mPrefix + "_add", t3, x5, r5),
            c.call(f2mPrefix + "_add", r5, r5, r5),
            c.call(f2mPrefix + "_add", t3, r5, r5),

        );
    }


    function buildCyclotomicExp(exponent, isExpNegative, fnName) {
        const exponentNafBytes = naf(exponent).map( (b) => (b==-1 ? 0xFF: b) );
        const pExponentNafBytes = module.alloc(exponentNafBytes);
        // const pExponent = module.alloc(utils.bigInt2BytesLE(exponent, n8));

        const f = module.addFunction(prefix+ "__cyclotomicExp_"+fnName);
        f.addParam("x", "i32");
        f.addParam("r", "i32");
        f.addLocal("bit", "i32");
        f.addLocal("i", "i32");

        const c = f.getCodeBuilder();

        const x = c.getLocal("x");

        const res = c.getLocal("r");

        const inverse = c.i32_const(module.alloc(ftsize));


        f.addCode(
            c.call(ftmPrefix + "_conjugate", x, inverse),
            c.call(ftmPrefix + "_one", res),

            c.if(
                c.teeLocal("bit", c.i32_load8_s(c.i32_const(exponentNafBytes.length-1), pExponentNafBytes)),
                c.if(
                    c.i32_eq(
                        c.getLocal("bit"),
                        c.i32_const(1)
                    ),
                    c.call(ftmPrefix + "_mul", res, x, res),
                    c.call(ftmPrefix + "_mul", res, inverse, res),
                )
            ),

            c.setLocal("i", c.i32_const(exponentNafBytes.length-2)),
            c.block(c.loop(
                c.call(prefix + "__cyclotomicSquare", res, res),
                c.if(
                    c.teeLocal("bit", c.i32_load8_s(c.getLocal("i"), pExponentNafBytes)),
                    c.if(
                        c.i32_eq(
                            c.getLocal("bit"),
                            c.i32_const(1)
                        ),
                        c.call(ftmPrefix + "_mul", res, x, res),
                        c.call(ftmPrefix + "_mul", res, inverse, res),
                    )
                ),
                c.br_if(1, c.i32_eqz ( c.getLocal("i") )),
                c.setLocal("i", c.i32_sub(c.getLocal("i"), c.i32_const(1))),
                c.br(0)
            ))
        );

        if (isExpNegative) {
            f.addCode(
                c.call(ftmPrefix + "_conjugate", res, res),
            );
        }

    }

    function buildFinalExponentiation() {
        buildCyclotomicSquare();
        buildCyclotomicExp(finalExpZ, finalExpIsNegative, "w0");

        const f = module.addFunction(prefix+ "_finalExponentiation");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const elt = c.getLocal("x");
        const res = c.getLocal("r");
        const t0 = c.i32_const(module.alloc(ftsize));
        const t1 = c.i32_const(module.alloc(ftsize));
        const t2 = c.i32_const(module.alloc(ftsize));
        const t3 = c.i32_const(module.alloc(ftsize));
        const t4 = c.i32_const(module.alloc(ftsize));
        const t5 = c.i32_const(module.alloc(ftsize));
        const t6 = c.i32_const(module.alloc(ftsize));

        f.addCode(

            // let mut t0 = f.frobenius_map(6)
            c.call(ftmPrefix + "_frobeniusMap6", elt, t0),

            // let t1 = f.invert()
            c.call(ftmPrefix + "_inverse", elt, t1),

            // let mut t2 = t0 * t1;
            c.call(ftmPrefix + "_mul", t0, t1, t2),

            // t1 = t2.clone();
            c.call(ftmPrefix + "_copy", t2, t1),

            // t2 = t2.frobenius_map().frobenius_map();
            c.call(ftmPrefix + "_frobeniusMap2", t2, t2),

            // t2 *= t1;
            c.call(ftmPrefix + "_mul", t2, t1, t2),


            // t1 = cyclotomic_square(t2).conjugate();
            c.call(prefix + "__cyclotomicSquare", t2, t1),
            c.call(ftmPrefix + "_conjugate", t1, t1),

            // let mut t3 = cycolotomic_exp(t2);
            c.call(prefix + "__cyclotomicExp_w0", t2, t3),

            // let mut t4 = cyclotomic_square(t3);
            c.call(prefix + "__cyclotomicSquare", t3, t4),

            // let mut t5 = t1 * t3;
            c.call(ftmPrefix + "_mul", t1, t3, t5),

            // t1 = cycolotomic_exp(t5);
            c.call(prefix + "__cyclotomicExp_w0", t5, t1),

            // t0 = cycolotomic_exp(t1);
            c.call(prefix + "__cyclotomicExp_w0", t1, t0),

            // let mut t6 = cycolotomic_exp(t0);
            c.call(prefix + "__cyclotomicExp_w0", t0, t6),

            // t6 *= t4;
            c.call(ftmPrefix + "_mul", t6, t4, t6),

            // t4 = cycolotomic_exp(t6);
            c.call(prefix + "__cyclotomicExp_w0", t6, t4),

            // t5 = t5.conjugate();
            c.call(ftmPrefix + "_conjugate", t5, t5),

            // t4 *= t5 * t2;
            c.call(ftmPrefix + "_mul", t4, t5, t4),
            c.call(ftmPrefix + "_mul", t4, t2, t4),

            // t5 = t2.conjugate();
            c.call(ftmPrefix + "_conjugate", t2, t5),

            // t1 *= t2;
            c.call(ftmPrefix + "_mul", t1, t2, t1),

            // t1 = t1.frobenius_map().frobenius_map().frobenius_map();
            c.call(ftmPrefix + "_frobeniusMap3", t1, t1),

            // t6 *= t5;
            c.call(ftmPrefix + "_mul", t6, t5, t6),

            // t6 = t6.frobenius_map();
            c.call(ftmPrefix + "_frobeniusMap1", t6, t6),

            // t3 *= t0;
            c.call(ftmPrefix + "_mul", t3, t0, t3),

            // t3 = t3.frobenius_map().frobenius_map();
            c.call(ftmPrefix + "_frobeniusMap2", t3, t3),

            // t3 *= t1;
            c.call(ftmPrefix + "_mul", t3, t1, t3),

            // t3 *= t6;
            c.call(ftmPrefix + "_mul", t3, t6, t3),

            // f = t3 * t4;
            c.call(ftmPrefix + "_mul", t3, t4, res),

        );
    }


    function buildFinalExponentiationOld() {
        const f = module.addFunction(prefix+ "_finalExponentiationOld");
        f.addParam("x", "i32");
        f.addParam("r", "i32");

        // is this still used? named old
        // replaced (ai calculation)
        const exponent = 106235210180198604882540316637075684287980329051238111995712139693546018932241093264494748071517306769622339016965887940545616868977740776956331114208669048096023014240030283855320732674822015112378045596475753063495283321189911277229538128310317445791755580241629777518429452509566814093808570263170688546841970142607560869182015848885859564228523394916206826862636201683731796555280069472532667538082636164060660638842021603784813823731520380479371974344117655405957823698301145598937472326227383106480110267333564349588316835947583857320684960027625317784475206375521701018975985181971458934997777312102509401630591177011279033972954698427162261132666863248969684734588277453910430665974711436060133451105684351674512967514992806571818658626536547054583817291316501456783707778290618432513663246053413325875830595947461081315402614147673827n;

        // 377 exponent is shorter, but for now leaving the same 544 -> 344
        const pExponent = module.alloc(utils.bigInt2BytesLE( exponent, 344 ));

        const c = f.getCodeBuilder();

        f.addCode(
            c.call(ftmPrefix + "_exp", c.getLocal("x"), c.i32_const(pExponent), c.i32_const(344), c.getLocal("r")),
        );
    }


    const pPreP = module.alloc(prePSize);
    const pPreQ = module.alloc(preQSize);

    function buildPairingEquation(nPairings) {

        const f = module.addFunction(prefix+ "_pairingEq"+nPairings);
        for (let i=0; i<nPairings; i++) {
            f.addParam("p_"+i, "i32");
            f.addParam("q_"+i, "i32");
        }
        f.addParam("c", "i32");
        f.setReturnType("i32");


        const c = f.getCodeBuilder();

        const resT = c.i32_const(module.alloc(ftsize));
        const auxT = c.i32_const(module.alloc(ftsize));

        f.addCode(c.call(ftmPrefix + "_one", resT ));

        for (let i=0; i<nPairings; i++) {

            f.addCode(c.call(prefix + "_prepareG1", c.getLocal("p_"+i), c.i32_const(pPreP) ));
            f.addCode(c.call(prefix + "_prepareG2", c.getLocal("q_"+i), c.i32_const(pPreQ) ));

            // Checks
            f.addCode(
                c.if(
                    c.i32_eqz(c.call(g1mPrefix + "_inGroupAffine", c.i32_const(pPreP))),
                    c.ret(c.i32_const(0))
                ),
                c.if(
                    c.i32_eqz(c.call(g2mPrefix + "_inGroupAffine", c.i32_const(pPreQ))),
                    c.ret(c.i32_const(0))
                )
            );

            f.addCode(c.call(prefix + "_millerLoop", c.i32_const(pPreP), c.i32_const(pPreQ), auxT ));

            f.addCode(c.call(ftmPrefix + "_mul", resT, auxT, resT ));
        }

        f.addCode(c.call(prefix + "_finalExponentiation", resT, resT ));

        f.addCode(c.call(ftmPrefix + "_eq", resT, c.getLocal("c")));
    }


    function buildPairing() {

        const f = module.addFunction(prefix+ "_pairing");
        f.addParam("p", "i32");
        f.addParam("q", "i32");
        f.addParam("r", "i32");

        const c = f.getCodeBuilder();

        const resT = c.i32_const(module.alloc(ftsize));

        f.addCode(c.call(prefix + "_prepareG1", c.getLocal("p"), c.i32_const(pPreP) ));
        f.addCode(c.call(prefix + "_prepareG2", c.getLocal("q"), c.i32_const(pPreQ) ));
        f.addCode(c.call(prefix + "_millerLoop", c.i32_const(pPreP), c.i32_const(pPreQ), resT ));
        f.addCode(c.call(prefix + "_finalExponentiation", resT, c.getLocal("r") ));
    }


    function buildInGroupG2() {
        const f = module.addFunction(g2mPrefix+ "_inGroupAffine");
        f.addParam("p", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        // replaced (according to ai calcs)
        const WINV = [
            129332213006484547005326366847446766768196756377457330269942131333360234174170411387484444069786680062220160729089n,
            129332213006484547005326366847446766768196756377457330269942131333360234174170411387484444069786680062220160729088n
        ];

        // [381] PSI_2_X = (u+1)^((1-p^2)/3)
        // [377] PSI_2_X = u^((p^2 - 1)/3) < a bit different
        // replaced
        const FROB2X = 80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n;
        
        // replaced
        const FROB3Y = [
            216465761340224619389371505802605247630151569547285782856803747159100223055385581585702401816380679166954762214499n,
            216465761340224619389371505802605247630151569547285782856803747159100223055385581585702401816380679166954762214499n
        ];

        const wInv = c.i32_const(module.alloc([
            ...utils.bigInt2BytesLE(toMontgomery(WINV[0]), n8q),
            ...utils.bigInt2BytesLE(toMontgomery(WINV[1]), n8q),
        ]));

        const frob2X = c.i32_const(module.alloc(utils.bigInt2BytesLE(toMontgomery(FROB2X), n8q)));
        const frob3Y = c.i32_const(module.alloc([
            ...utils.bigInt2BytesLE(toMontgomery(FROB3Y[0]), n8q),
            ...utils.bigInt2BytesLE(toMontgomery(FROB3Y[1]), n8q),
        ]));

        const z = c.i32_const(module.alloc(utils.bigInt2BytesLE(finalExpZ, 8)));

        const px = c.getLocal("p");
        const py = c.i32_add(c.getLocal("p"), c.i32_const(f2size));

        const aux = c.i32_const(module.alloc(f1size));

        const x_winv = c.i32_const(module.alloc(f2size));
        const y_winv = c.i32_const(module.alloc(f2size));
        const pf2 = module.alloc(f2size*2);
        const f2 = c.i32_const(pf2);
        const f2x = c.i32_const(pf2);
        const f2x_c1 = c.i32_const(pf2);
        const f2x_c2 = c.i32_const(pf2+f1size);
        const f2y = c.i32_const(pf2+f2size);
        const f2y_c1 = c.i32_const(pf2+f2size);
        const f2y_c2 = c.i32_const(pf2+f2size+f1size);
        const pf3 = module.alloc(f2size*3);
        const f3 = c.i32_const(pf3);
        const f3x = c.i32_const(pf3);
        const f3x_c1 = c.i32_const(pf3);
        const f3x_c2 = c.i32_const(pf3+f1size);
        const f3y = c.i32_const(pf3+f2size);
        const f3y_c1 = c.i32_const(pf3+f2size);
        const f3y_c2 = c.i32_const(pf3+f2size+f1size);
        const f3z = c.i32_const(pf3+f2size*2);


        f.addCode(
            c.if(
                c.call(g2mPrefix + "_isZeroAffine", c.getLocal("p")),
                c.ret( c.i32_const(1)),
            ),
            c.if(
                c.i32_eqz(c.call(g2mPrefix + "_inCurveAffine", c.getLocal("p"))),
                c.ret( c.i32_const(0)),
            ),
            c.call(f2mPrefix + "_mul", px, wInv, x_winv),
            c.call(f2mPrefix + "_mul", py, wInv, y_winv),

            c.call(f2mPrefix + "_mul1", x_winv, frob2X, f2x),
            c.call(f2mPrefix + "_neg", y_winv, f2y),

            c.call(f2mPrefix + "_neg", x_winv, f3x),
            c.call(f2mPrefix + "_mul", y_winv, frob3Y, f3y),

            c.call(f1mPrefix + "_sub", f2x_c1, f2x_c2, aux),
            c.call(f1mPrefix + "_add", f2x_c1, f2x_c2, f2x_c2),
            c.call(f1mPrefix + "_copy", aux, f2x_c1),

            c.call(f1mPrefix + "_sub", f2y_c1, f2y_c2, aux),
            c.call(f1mPrefix + "_add", f2y_c1, f2y_c2, f2y_c2),
            c.call(f1mPrefix + "_copy", aux, f2y_c1),

            c.call(f1mPrefix + "_add", f3x_c1, f3x_c2, aux),
            c.call(f1mPrefix + "_sub", f3x_c1, f3x_c2, f3x_c2),
            c.call(f1mPrefix + "_copy", aux, f3x_c1),

            c.call(f1mPrefix + "_sub", f3y_c2, f3y_c1, aux),
            c.call(f1mPrefix + "_add", f3y_c1, f3y_c2, f3y_c2),
            c.call(f1mPrefix + "_copy", aux, f3y_c1),

            c.call(f2mPrefix + "_one", f3z),

            c.call(g2mPrefix + "_timesScalar", f3, z, c.i32_const(8), f3),
            c.call(g2mPrefix + "_addMixed", f3, f2, f3),

            c.ret(
                c.call(g2mPrefix + "_eqMixed", f3, c.getLocal("p"))
            )
        );

        const fInGroup = module.addFunction(g2mPrefix + "_inGroup");
        fInGroup.addParam("pIn", "i32");
        fInGroup.setReturnType("i32");

        const c2 = fInGroup.getCodeBuilder();

        const aux2 = c2.i32_const(module.alloc(f2size*2));

        fInGroup.addCode(
            c2.call(g2mPrefix + "_toAffine", c2.getLocal("pIn"), aux2),

            c2.ret(
                c2.call(g2mPrefix + "_inGroupAffine", aux2),
            )
        );

    }

    function buildInGroupG1() {
        const f = module.addFunction(g1mPrefix+ "_inGroupAffine");
        f.addParam("p", "i32");
        f.setReturnType("i32");

        const c = f.getCodeBuilder();

        // PSI_2_X = (u+1)^((1-p^2)/3)
        // replaced
        const BETA = 80949648264912719408558363140637477264845294720710499478137287262712535938301461879813459410945n;

        // replaced
        const BETA2 = 258664426012969093929703085429980814127835149614277183275038967946009968870203535512256352201271898244626862047231n;
        const Z2M1D3 = (finalExpZ * finalExpZ - 1n) / 3n;

        const beta = c.i32_const(module.alloc(utils.bigInt2BytesLE(toMontgomery(BETA), n8q)));
        const beta2 = c.i32_const(module.alloc(utils.bigInt2BytesLE(toMontgomery(BETA2), n8q)));

        const z2m1d3 = c.i32_const(module.alloc(utils.bigInt2BytesLE(Z2M1D3, 16)));


        const px = c.getLocal("p");
        const py = c.i32_add(c.getLocal("p"), c.i32_const(f1size));

        const psp = module.alloc(f1size*3);
        const sp = c.i32_const(psp);
        const spx = c.i32_const(psp);
        const spy = c.i32_const(psp+f1size);

        const ps2p = module.alloc(f1size*2);
        const s2p = c.i32_const(ps2p);
        const s2px = c.i32_const(ps2p);
        const s2py = c.i32_const(ps2p+f1size);

        f.addCode(
            c.if(
                c.call(g1mPrefix + "_isZeroAffine", c.getLocal("p")),
                c.ret( c.i32_const(1)),
            ),
            c.if(
                c.i32_eqz(c.call(g1mPrefix + "_inCurveAffine", c.getLocal("p"))),
                c.ret( c.i32_const(0)),
            ),

            c.call(f1mPrefix + "_mul", px, beta, spx),
            c.call(f1mPrefix + "_copy", py, spy),

            c.call(f1mPrefix + "_mul", px, beta2, s2px),
            c.call(f1mPrefix + "_copy", py, s2py),


            c.call(g1mPrefix + "_doubleAffine", sp, sp),
            c.call(g1mPrefix + "_subMixed", sp, c.getLocal("p"), sp),
            c.call(g1mPrefix + "_subMixed", sp, s2p, sp),

            c.call(g1mPrefix + "_timesScalar", sp, z2m1d3, c.i32_const(16), sp),

            c.ret(
                c.call(g1mPrefix + "_eqMixed", sp, s2p)
            )

        );

        const fInGroup = module.addFunction(g1mPrefix + "_inGroup");
        fInGroup.addParam("pIn", "i32");
        fInGroup.setReturnType("i32");

        const c2 = fInGroup.getCodeBuilder();

        const aux2 = c2.i32_const(module.alloc(f1size*2));

        fInGroup.addCode(
            c2.call(g1mPrefix + "_toAffine", c2.getLocal("pIn"), aux2),

            c2.ret(
                c2.call(g1mPrefix + "_inGroupAffine", aux2),
            )
        );
    }

    for (let i=0; i<10; i++) {
        buildFrobeniusMap(i);
        module.exportFunction(ftmPrefix + "_frobeniusMap"+i);
    }


    buildInGroupG1();
    buildInGroupG2();

    buildPrepAddStep();
    buildPrepDoubleStep();

    buildPrepareG1();
    buildPrepareG2();

    buildMillerLoop();

    buildFinalExponentiationOld();
    buildFinalExponentiation();

    for (let i=1; i<=5; i++) {
        buildPairingEquation(i);
        module.exportFunction(prefix + "_pairingEq"+i);
    }

    buildPairing();

    module.exportFunction(prefix + "_pairing");


    module.exportFunction(prefix + "_prepareG1");
    module.exportFunction(prefix + "_prepareG2");
    module.exportFunction(prefix + "_millerLoop");
    module.exportFunction(prefix + "_finalExponentiation");
    module.exportFunction(prefix + "_finalExponentiationOld");
    module.exportFunction(prefix + "__cyclotomicSquare");
    module.exportFunction(prefix + "__cyclotomicExp_w0");

    module.exportFunction(f6mPrefix + "_mul1");
    module.exportFunction(f6mPrefix + "_mul01");
    module.exportFunction(ftmPrefix + "_mul014");

    module.exportFunction(g1mPrefix + "_inGroupAffine");
    module.exportFunction(g1mPrefix + "_inGroup");
    module.exportFunction(g2mPrefix + "_inGroupAffine");
    module.exportFunction(g2mPrefix + "_inGroup");

    // console.log(module.functionIdxByName);
};

