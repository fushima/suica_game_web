import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import './SuicaGame.css';

interface Ball {
  body: Matter.Body;
  level: number;
}

const BALL_CONFIGS = [
  { radius: 25, color: '#FF8A80', pattern: '🍒' },  // レベル1: さくらんぼ
  { radius: 35, color: '#FFD54F', pattern: '🍋' },  // レベル2: レモン
  { radius: 45, color: '#FF6E40', pattern: '🍊' },  // レベル3: オレンジ
  { radius: 55, color: '#E91E63', pattern: '🍑' },  // レベル4: 桃
  { radius: 65, color: '#9C27B0', pattern: '🍇' },  // レベル5: ぶどう
  { radius: 75, color: '#FFC107', pattern: '🍍' },  // レベル6: パイナップル
  { radius: 85, color: '#8BC34A', pattern: '🍏' },  // レベル7: りんご
  { radius: 95, color: '#795548', pattern: '🥥' },  // レベル8: ココナッツ
  { radius: 110, color: '#4CAF50', pattern: '🍉' },  // レベル9: スイカ
];

type GameMode = 'normal' | 'moon';

const SuicaGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const ballsRef = useRef<Map<number, Ball>>(new Map());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextBallLevel, setNextBallLevel] = useState(0);
  const [canDrop, setCanDrop] = useState(true);
  const [dropPosition, setDropPosition] = useState(400);
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  const [gameStarted, setGameStarted] = useState(false);

  const createBall = useCallback((x: number, y: number, level: number): Ball => {
    const config = BALL_CONFIGS[level];
    const restitution = gameMode === 'moon' ? 0.7 : 0.3;
    const friction = gameMode === 'moon' ? 0.05 : 0.1;
    const density = gameMode === 'moon' ? 0.0005 : 0.001;
    
    const body = Matter.Bodies.circle(x, y, config.radius, {
      restitution,
      friction,
      density,
      label: `ball-${level}`,
      render: {
        fillStyle: config.color,
      },
    });
    
    return { body, level };
  }, [gameMode]);

  const checkGameOver = useCallback(() => {
    const bodies = Matter.Composite.allBodies(engineRef.current!.world);
    const gameBalls = bodies.filter(body => body.label.startsWith('ball-'));
    
    for (const ball of gameBalls) {
      if (ball.position.y < 50 && ball.velocity.y < 0.1) {
        setGameOver(true);
        return true;
      }
    }
    return false;
  }, []);

  const mergeBalls = useCallback((ballA: Ball, ballB: Ball) => {
    if (ballA.level !== ballB.level || ballA.level >= BALL_CONFIGS.length - 1) {
      return;
    }

    const midX = (ballA.body.position.x + ballB.body.position.x) / 2;
    const midY = (ballA.body.position.y + ballB.body.position.y) / 2;
    
    Matter.World.remove(engineRef.current!.world, [ballA.body, ballB.body]);
    ballsRef.current.delete(ballA.body.id);
    ballsRef.current.delete(ballB.body.id);
    
    const newLevel = ballA.level + 1;
    const newBall = createBall(midX, midY, newLevel);
    Matter.World.add(engineRef.current!.world, newBall.body);
    ballsRef.current.set(newBall.body.id, newBall);
    
    const points = (newLevel + 1) * 10;
    setScore(prev => prev + points);
  }, [createBall]);

  const dropBall = useCallback(() => {
    if (!canDrop || gameOver || !engineRef.current) return;
    
    const ball = createBall(dropPosition, 60, nextBallLevel);
    Matter.World.add(engineRef.current.world, ball.body);
    ballsRef.current.set(ball.body.id, ball);
    
    setCanDrop(false);
    const dropDelay = gameMode === 'moon' ? 800 : 500;
    setTimeout(() => {
      setCanDrop(true);
      setNextBallLevel(Math.floor(Math.random() * 5));
    }, dropDelay);
  }, [canDrop, gameOver, nextBallLevel, dropPosition, createBall, gameMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      setDropPosition(Math.max(40, Math.min(560, x)));
    }
  }, []);

  const resetGame = useCallback(() => {
    if (engineRef.current) {
      const bodies = Matter.Composite.allBodies(engineRef.current.world);
      const gameBalls = bodies.filter(body => body.label.startsWith('ball-'));
      Matter.World.remove(engineRef.current.world, gameBalls);
      ballsRef.current.clear();
    }
    setScore(0);
    setGameOver(false);
    setCanDrop(true);
    setNextBallLevel(0);
    setGameStarted(false);
  }, []);

  const startGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setGameStarted(true);
    setScore(0);
    setGameOver(false);
    setCanDrop(true);
    setNextBallLevel(0);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !gameStarted) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = gameMode === 'moon' ? 0.1 : 0.6;
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: containerRef.current,
      engine: engine,
      options: {
        width: 600,
        height: 500,
        wireframes: false,
        background: gameMode === 'moon' ? '#0a0a2e' : '#F8F8F8',
        showAngleIndicator: false,
      },
    });
    renderRef.current = render;

    const ground = Matter.Bodies.rectangle(300, 490, 600, 20, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });
    
    const leftWall = Matter.Bodies.rectangle(10, 250, 20, 500, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });
    
    const rightWall = Matter.Bodies.rectangle(590, 250, 20, 500, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });

    Matter.World.add(engine.world, [ground, leftWall, rightWall]);

    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        if (bodyA.label.startsWith('ball-') && bodyB.label.startsWith('ball-')) {
          const ballA = ballsRef.current.get(bodyA.id);
          const ballB = ballsRef.current.get(bodyB.id);
          
          if (ballA && ballB && ballA.level === ballB.level) {
            mergeBalls(ballA, ballB);
          }
        }
      });
    });

    Matter.Events.on(engine, 'afterUpdate', () => {
      checkGameOver();
    });

    // カスタムレンダリング
    Matter.Events.on(render, 'afterRender', () => {
      const context = render.context;
      const bodies = Matter.Composite.allBodies(engine.world);
      
      bodies.forEach(body => {
        if (body.label.startsWith('ball-')) {
          const level = parseInt(body.label.split('-')[1]);
          const config = BALL_CONFIGS[level];
          
          if (config && config.pattern) {
            context.save();
            context.translate(body.position.x, body.position.y);
            context.rotate(body.angle);
            
            // 果物の絵文字を描画
            context.font = `${config.radius * 1.5}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(config.pattern, 0, 0);
            
            context.restore();
          }
        }
      });
    });

    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
    };
  }, [mergeBalls, checkGameOver, gameMode, gameStarted]);

  if (!gameStarted) {
    return (
      <div className="game-container">
        <div className="mode-selection">
          <h1>🍉 スイカゲーム 🍉</h1>
          <h2>モードを選択してください</h2>
          <div className="mode-buttons">
            <button 
              onClick={() => startGame('normal')} 
              className="mode-button normal-mode"
            >
              <span className="mode-icon">🌍</span>
              <span className="mode-title">通常モード</span>
              <span className="mode-desc">地球の重力でプレイ</span>
            </button>
            <button 
              onClick={() => startGame('moon')} 
              className="mode-button moon-mode"
            >
              <span className="mode-icon">🌙</span>
              <span className="mode-title">月面モード</span>
              <span className="mode-desc">低重力でふわふわプレイ</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-container ${gameMode === 'moon' ? 'moon-mode' : ''}`}>
      <div className="game-header">
        <div className="mode-indicator">
          {gameMode === 'moon' ? '🌙 月面モード' : '🌍 通常モード'}
        </div>
        <div className="score">スコア: {score}</div>
        <button onClick={resetGame} className="reset-button">リセット</button>
      </div>
      
      <div className="game-wrapper">
        {gameMode === 'moon' && (
          <div className="stars"></div>
        )}
        {canDrop && !gameOver && (
          <div 
            className="next-ball-preview" 
            style={{ 
              left: `${dropPosition}px`,
              backgroundColor: BALL_CONFIGS[nextBallLevel].color,
              width: `${BALL_CONFIGS[nextBallLevel].radius * 2}px`,
              height: `${BALL_CONFIGS[nextBallLevel].radius * 2}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${BALL_CONFIGS[nextBallLevel].radius * 1.5}px`,
            }}
          >
            {BALL_CONFIGS[nextBallLevel].pattern}
          </div>
        )}
        
        <div
          ref={containerRef}
          onClick={dropBall}
          onMouseMove={handleMouseMove}
          className="game-canvas-container"
        />
      </div>
      
      {gameOver && (
        <div className="game-over">
          <h2>ゲームオーバー!</h2>
          <p>最終スコア: {score}</p>
          <button onClick={resetGame}>もう一度プレイ</button>
        </div>
      )}
    </div>
  );
};

export default SuicaGame;