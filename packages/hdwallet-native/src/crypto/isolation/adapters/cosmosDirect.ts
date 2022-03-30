import type { AccountData, OfflineDirectSigner, DirectSignResponse } from "@cosmjs/proto-signing";
import * as bech32 from "bech32";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

import { Digest, SecP256K1 } from "../core";

const cosmJsProtoSigning = import("@cosmjs/proto-signing");

export class OfflineDirectSignerAdapter implements OfflineDirectSigner {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey;
  protected readonly _pubkey: Uint8Array;
  protected readonly _address: string;

  protected constructor(isolatedKey: SecP256K1.ECDSAKey, pubkey: Uint8Array, address: string) {
    this._isolatedKey = isolatedKey;
    this._pubkey = pubkey;
    this._address = address;
  }

  static async create(isolatedKey: SecP256K1.ECDSAKey, prefix: string): Promise<OfflineDirectSignerAdapter> {
    const pubkey = await isolatedKey.publicKey;
    const address = bech32.encode(
      prefix,
      bech32.toWords(Digest.Algorithms.ripemd160(Digest.Algorithms.sha256(isolatedKey.publicKey)))
    );
    return new OfflineDirectSignerAdapter(isolatedKey, pubkey, address);
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return [
      {
        address: this._address,
        algo: "secp256k1",
        pubkey: this._pubkey,
      },
    ];
  }

  async signDirect(signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> {
    if (signerAddress !== this._address) throw new Error("signerAddress mismatch");

    const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);
    const signDigest = Digest.Algorithms.sha256(signBytes)
    const signatureBytes = await this._isolatedKey.ecdsaSign(signDigest);
    return {
      signed: signDoc,
      signature: {
        pub_key: {
          type: "tendermint/PubKeySecp256k1",
          value: Buffer.from(this._pubkey).toString("base64")
        },
        signature: Buffer.from(signatureBytes).toString("base64")
      },
    };
  }
}

export default OfflineDirectSignerAdapter;