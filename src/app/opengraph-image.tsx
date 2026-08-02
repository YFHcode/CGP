import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'ChartGoldPrice — gold and silver price charts'

/**
 * Social preview card, generated at build time.
 *
 * The metadata previously pointed at /og-image.png, which did not exist in
 * public/ — so every share rendered a broken preview.
 */
export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000',
                    backgroundImage:
                        'radial-gradient(circle at 50% 0%, rgba(214,169,62,0.28), transparent 60%)',
                    color: '#fff',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 96,
                        height: 96,
                        borderRadius: 24,
                        background: 'linear-gradient(135deg, #d6a93e, #ad7019)',
                        color: '#000',
                        fontSize: 52,
                        fontWeight: 700,
                        marginBottom: 32,
                    }}
                >
                    Au
                </div>
                <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>
                    <span>Chart</span>
                    <span style={{ color: '#d6a93e' }}>Gold</span>
                    <span>Price</span>
                </div>
                <div
                    style={{
                        marginTop: 20,
                        fontSize: 30,
                        color: '#a1a1aa',
                        textAlign: 'center',
                        maxWidth: 860,
                    }}
                >
                    Gold &amp; silver prices, historical charts and a karat value calculator
                </div>
            </div>
        ),
        { ...size }
    )
}
