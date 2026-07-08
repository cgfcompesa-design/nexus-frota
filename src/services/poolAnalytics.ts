import { PoolRecord } from "../services/poolService";

export interface DashboardCards {
    totalVouchers: number;
    custoTotal: number;
    custoMedio: number;
    kmTotal: number;
    litrosTotal: number;
    consumoMedio: number;
    disponiveis: number;
    indisponiveis: number;
    disponibilidadeFisica: number;
}

function groupBy<T>(
    array: T[],
    keyGetter: (item: T) => string
): Map<string, T[]> {

    const map = new Map<string, T[]>();

    array.forEach(item => {

        const key = keyGetter(item);

        const collection = map.get(key);

        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }

    });

    return map;
}

export function getDashboardCards(
    data: PoolRecord[]
): DashboardCards {

    const totalVouchers = data.length;

    const custoTotal = data.reduce(
        (sum, row) => sum + (row.valor || 0),
        0
    );

    const kmTotal = data.reduce(
        (sum, row) => sum + (row.km || 0),
        0
    );

    const litrosTotal = data.reduce(
        (sum, row) => sum + (row.litros || 0),
        0
    );

    const disponiveis = data.filter(
        x =>
            (x.status || "")
                .toLowerCase()
                .includes("dispon")
    ).length;

    const indisponiveis = data.length - disponiveis;

    return {

        totalVouchers,

        custoTotal,

        custoMedio:
            totalVouchers === 0
                ? 0
                : custoTotal / totalVouchers,

        kmTotal,

        litrosTotal,

        consumoMedio:
            litrosTotal === 0
                ? 0
                : kmTotal / litrosTotal,

        disponiveis,

        indisponiveis,

        disponibilidadeFisica:
            data.length === 0
                ? 0
                : (disponiveis / data.length) * 100

    };

}

export function getRankingUnidades(data: PoolRecord[]) {

    const grupos = groupBy(
        data,
        x => x.unidade || "Não Informada"
    );

    const resultado = [];

    grupos.forEach((rows, unidade) => {

        resultado.push({

            unidade,

            vouchers: rows.length,

            custo: rows.reduce(
                (s, r) => s + (r.valor || 0),
                0
            ),

            km: rows.reduce(
                (s, r) => s + (r.km || 0),
                0
            )

        });

    });

    return resultado.sort(
        (a, b) => b.custo - a.custo
    );

}

export function getRankingUsuarios(
    data: PoolRecord[]
) {

    const grupos = groupBy(
        data,
        x => x.usuario || "Não Informado"
    );

    const resultado = [];

    grupos.forEach((rows, usuario) => {

        resultado.push({

            usuario,

            quantidade: rows.length,

            custo: rows.reduce(
                (s, r) => s + (r.valor || 0),
                0
            )

        });

    });

    return resultado.sort(
        (a, b) => b.quantidade - a.quantidade
    );

}

export function getTopKm(
    data: PoolRecord[]
) {

    const grupos = groupBy(
        data,
        x => x.placa || "SEM PLACA"
    );

    const resultado = [];

    grupos.forEach((rows, placa) => {

        resultado.push({

            placa,

            km: rows.reduce(
                (s, r) => s + (r.km || 0),
                0
            )

        });

    });

    return resultado
        .sort((a, b) => b.km - a.km)
        .slice(0, 10);

}

export function getTopConsumo(
    data: PoolRecord[]
) {

    const grupos = groupBy(
        data,
        x => x.placa || "SEM PLACA"
    );

    const resultado = [];

    grupos.forEach((rows, placa) => {

        resultado.push({

            placa,

            litros: rows.reduce(
                (s, r) => s + (r.litros || 0),
                0
            )

        });

    });

    return resultado
        .sort((a, b) => b.litros - a.litros)
        .slice(0, 10);

}

export function getTopCusto(
    data: PoolRecord[]
) {

    const grupos = groupBy(
        data,
        x => x.placa || "SEM PLACA"
    );

    const resultado = [];

    grupos.forEach((rows, placa) => {

        resultado.push({

            placa,

            custo: rows.reduce(
                (s, r) => s + (r.valor || 0),
                0
            )

        });

    });

    return resultado
        .sort((a, b) => b.custo - a.custo)
        .slice(0, 10);

}

export function getMaioresCorridas(
    data: PoolRecord[]
) {

    return [...data]
        .sort(
            (a, b) => (b.km || 0) - (a.km || 0)
        )
        .slice(0, 20);

}
