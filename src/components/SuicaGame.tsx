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
  { radius: 70, color: '#4CAF50', pattern: '🍉' },  // レベル5: スイカ
];

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

  const createBall = useCallback((x: number, y: number, level: number): Ball => {
    const config = BALL_CONFIGS[level];
    const body = Matter.Bodies.circle(x, y, config.radius, {
      restitution: 0.3,
      friction: 0.1,
      density: 0.001,
      label: `ball-${level}`,
      render: {
        fillStyle: config.color,
      },
    });
    
    return { body, level };
  }, []);

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
    setTimeout(() => {
      setCanDrop(true);
      setNextBallLevel(Math.floor(Math.random() * 3));
    }, 500);
  }, [canDrop, gameOver, nextBallLevel, dropPosition, createBall]);

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
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 0.6;
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: containerRef.current,
      engine: engine,
      options: {
        width: 600,
        height: 500,
        wireframes: false,
        background: '#F8F8F8',
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
  }, [mergeBalls, checkGameOver]);

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="score">スコア: {score}</div>
        <button onClick={resetGame} className="reset-button">リセット</button>
      </div>
      
      <div className="game-wrapper">
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